import {BaseProjectProcessor, type Issue, type ProcessorContext} from './base';
import {getGitlabIssueList} from '../gitlab';
import {initTrafficLight} from '../cache';
import {createTask, createSession, createMessage, updateTaskStatus} from '../queries';
import {createRunner} from '../runners';
import {sendTelegramMessage} from '../telegram';
import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';
import chalk from 'chalk';

export type LegacyCompletionInfo = {
  issue: Issue;
  result: string;
  cost: number;
  iterations: number;
};

export type GitlabConfig = {
  repo: string;
  labels: string[];
  host?: string;
};

export class GitlabProjectProcessor extends BaseProjectProcessor {
  private config: GitlabConfig;

  constructor(context: ProcessorContext) {
    super(context);
    this.config = context.project.config as GitlabConfig;
  }

  async processIssues(): Promise<void> {
    for await (const issue of this.getIssues()) {
      await this.processLegacyIssue(issue);
    }
  }

  async processIssue(_issue: import('../task-sources/base').TaskSourceIssue): Promise<void> {
    throw new Error('GitlabProjectProcessor is deprecated. Use GenericProjectProcessor instead.');
  }

  async *getIssues(): AsyncIterable<Issue> {
    const issues = getGitlabIssueList(this.config.repo, this.config.labels);
    for (const issue of issues) {
      yield issue;
    }
  }

  setupWorkspace(issue: Issue): string {
    const workspaceDir = path.join(this.context.appsDir, `gitlab-${issue.id()}`);
    const branchName = `issue/gitlab-${issue.id()}`;

    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, {recursive: true});
      console.log(chalk.yellow(`Cloning repository ${this.config.repo} into ${workspaceDir}...`));
      execSync(`glab repo clone ${this.config.repo} ${workspaceDir}`, {stdio: 'inherit'});
    }

    const branchExists = execSync(
      `git -C ${workspaceDir} rev-parse --verify ${branchName} 2>/dev/null || echo ""`,
      {encoding: 'utf-8'}
    ).trim() !== '';

    if (branchExists) {
      console.log(chalk.green(`Checking out existing branch ${branchName}...`));
      execSync(`git -C ${workspaceDir} checkout ${branchName}`, {stdio: 'inherit'});
    } else {
      console.log(chalk.green(`Creating and checking out new branch ${branchName}...`));
      execSync(`git -C ${workspaceDir} checkout -b ${branchName}`, {stdio: 'inherit'});
    }

    return workspaceDir;
  }

  async processLegacyIssue(issue: Issue): Promise<void> {
    const signaler = initTrafficLight(this.context.project.id);

    console.log(chalk.blue.bold(`[${this.config.repo}] New or updated issue:`), issue.title());

    if (await signaler.isSignaledBefore(issue.uniqueId(), issue.updatedAt())) {
      console.log(chalk.gray(`[${this.config.repo}] Skipping already processed issue: ${issue.title()}`));
      return;
    }

    if (!(await signaler.tryAcquireLock({
      issueId: issue.uniqueId(),
      workerId: this.context.workerId,
      lockTimeoutSeconds: 3600
    }))) {
      console.log(chalk.yellow(`[${this.config.repo}] Issue ${issue.id()} is being processed by another worker`));
      return;
    }

    try {
      const selectedRunner = this.context.selectRunner();
      console.log(chalk.cyan(`Selected runner: ${selectedRunner}`));

      const task = await createTask(this.context.sql, {
        title: issue.title(),
        description: `GitLab Issue #${issue.id()} from ${this.config.repo}`,
        status: 'processing',
        project_id: this.context.project.id,
        source_gitlab_issue: {
          id: issue.id(),
          iid: issue.iid ? issue.iid() : null,
          repo: this.config.repo,
          title: issue.title(),
          updated_at: issue.updatedAt()
        }
      });
      console.log(chalk.green(`Created task ${task.id} for issue ${issue.id()}`));

      const session = await createSession(this.context.sql, {
        task_id: task.id,
        runner: selectedRunner
      });
      console.log(chalk.green(`Created session ${session.id} with runner ${selectedRunner}`));

      const workspaceDir = this.setupWorkspace(issue);
      const branchName = `issue/gitlab-${issue.id()}`;

      const runner = createRunner(selectedRunner);
      const iterator = runner.query({
        prompt: `You are working on GitLab issue #${issue.id()}: ${issue.title()}

CRITICAL FIRST STEP:
- Your FIRST action must be: \`glab issue view ${issue.id()}\`
- Read and understand the COMPLETE issue description and ALL comments before doing anything else
- Do NOT proceed with any implementation until you've analyzed the full issue context

IMPORTANT INSTRUCTIONS:
- Do ONLY what is explicitly asked in the issue - no extra features, improvements, or refactoring
- You are currently on branch "${branchName}" - all your work should be done on this branch
- Avoid installing dependencies (npm install) unless absolutely required for the task
- Use npm for package management (no other package managers)
- Use glab CLI for GitLab operations (issues, MRs, etc.) - it's already configured and available
- Be concise in your responses - focus on actions, not explanations

COMMUNICATION REQUIREMENTS:
- Post progress updates as comments to the issue using: \`glab issue note ${issue.id()} --message "your update"\`
- Write comments when starting significant steps (e.g., "Starting implementation", "Running tests", etc.)
- Keep comments brief and informative

COMPLETION REQUIREMENTS (you MUST complete ALL of these):
1. Implement the required changes
2. Commit your changes with a clear commit message
3. Push the branch to remote: \`git push origin ${branchName}\`
4. Create a Merge Request using: \`glab mr create --fill --source-branch ${branchName} --target-branch main\`
5. After creating the MR, link it to the issue by commenting: \`glab issue note ${issue.id()} --message "MR created: [link to MR]"\`
6. The iteration is NOT finished until the MR is created and linked to the issue
7. In your final result, return a simple summary of what was done (1-2 sentences max)`,
        options: {
          permissionMode: 'bypassPermissions',
          env: process.env as Record<string, string>,
          executable: 'bun',
          cwd: workspaceDir,
          stderr: _data => {
            // Append to file
          },
          allowedTools: ['Bash(npm: *)', 'Bash(glab: *)', 'Bash(git: *)', 'Read', 'Write', 'Edit', 'Glob'],
        }
      });

      let iterations = 0;
      let finalCost = 0;
      for await (const chunk of iterator) {
        iterations++;

        await createMessage(this.context.sql, {
          session_id: session.id,
          data: chunk
        });

        if (chunk.type === 'result') {
          finalCost = chunk.total_cost_usd;
          const resultText = chunk.result;

          await updateTaskStatus(this.context.sql, task.id, 'completed');
          await signaler.signal({
            issueId: issue.uniqueId(),
            date: new Date(),
            taskId: task.id
          });

          try {
            console.log(chalk.yellow('Sending Telegram notification...'));
            const message = this.generateTelegramMessage({
              issue,
              result: resultText,
              cost: finalCost,
              iterations
            });
            await sendTelegramMessage(this.context.telegramConfig, {text: message});
            console.log(chalk.green('Telegram notification sent!'));
          } catch (error) {
            console.error(chalk.red('Failed to send Telegram notification:'), error);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`[${this.config.repo}] Error processing issue ${issue.id()}:`), error);
      await signaler.releaseLock(issue.uniqueId());
      throw error;
    }
  }

  private generateTelegramMessage(info: LegacyCompletionInfo): string {
    const branchName = `issue/gitlab-${info.issue.id()}`;
    const issueUrl = `https://gitlab.com/${this.config.repo}/-/issues/${info.issue.id()}`;

    return `✅ <b>Issue Completed</b>

<a href="${issueUrl}">${info.issue.title()}</a>

Branch: <code>${branchName}</code>
Iterations: ${info.iterations} | Cost: $${info.cost.toFixed(4)}

<b>Result:</b>
${info.result}`;
  }
}
