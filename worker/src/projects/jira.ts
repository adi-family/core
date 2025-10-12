import {BaseProjectProcessor, type Issue, type ProcessorContext} from './base';
import {initTrafficLight} from '../cache';
import {createTask, createSession, createMessage, updateTaskStatus} from '../queries';
import {createRunner} from '../runners';
import {sendTelegramMessage} from '../telegram';
import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';
import chalk from 'chalk';
import {Issue as IssueBase} from '../issue';

export type JiraCompletionInfo = {
  issue: JiraIssue;
  result: string;
  cost: number;
  iterations: number;
};

export type JiraConfig = {
  project_key: string;
  jql_filter?: string;
  host: string;
  repo?: string;
};

class JiraIssue extends IssueBase {
  constructor(
    private issue: {
      key: string;
      id: string;
      fields: {
        summary: string;
        updated: string;
      };
    }
  ) {
    super();
  }

  provider(): string {
    return 'jira';
  }

  id(): string {
    return this.issue.id;
  }

  key(): string {
    return this.issue.key;
  }

  title(): string {
    return this.issue.fields.summary;
  }

  updatedAt(): Date {
    return new Date(this.issue.fields.updated);
  }
}

export class JiraProjectProcessor extends BaseProjectProcessor {
  private config: JiraConfig;

  constructor(context: ProcessorContext) {
    super(context);
    this.config = context.project.config as JiraConfig;
  }

  async processIssues(): Promise<void> {
    for await (const issue of this.getIssues()) {
      await this.processLegacyIssue(issue);
    }
  }

  async processIssue(_issue: import('../task-sources/base').TaskSourceIssue, _fileSpace: import('../file-spaces/base').BaseFileSpace): Promise<void> {
    throw new Error('JiraProjectProcessor is deprecated. Use GenericProjectProcessor instead.');
  }

  async *getIssues(): AsyncIterable<Issue> {
    const jqlQuery = this.config.jql_filter
      ? this.config.jql_filter
      : `project = ${this.config.project_key} AND status = "To Do"`;

    try {
      const result = execSync(
        `curl -s -X GET -H "Content-Type: application/json" "${this.config.host}/rest/api/2/search?jql=${encodeURIComponent(jqlQuery)}"`,
        {encoding: 'utf-8'}
      );

      const data = JSON.parse(result);
      if (data.issues) {
        for (const issue of data.issues) {
          yield new JiraIssue(issue);
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to fetch Jira issues:'), error);
    }
  }

  setupWorkspace(issue: Issue): string {
    const jiraIssue = issue as JiraIssue;
    const workspaceDir = path.join(this.context.appsDir, `jira-${jiraIssue.key()}`);
    const branchName = `issue/jira-${jiraIssue.key()}`;

    if (!this.config.repo) {
      throw new Error('Jira project config must include repo field for workspace setup');
    }

    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, {recursive: true});
      console.log(chalk.yellow(`Cloning repository ${this.config.repo} into ${workspaceDir}...`));
      execSync(`git clone ${this.config.repo} ${workspaceDir}`, {stdio: 'inherit'});
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
    const jiraIssue = issue as JiraIssue;
    const signaler = initTrafficLight(this.context.project.id);

    console.log(chalk.blue.bold(`[Jira/${this.config.project_key}] New or updated issue:`), issue.title());

    if (await signaler.isSignaledBefore(issue.uniqueId(), issue.updatedAt())) {
      console.log(chalk.gray(`[Jira/${this.config.project_key}] Skipping already processed issue: ${issue.title()}`));
      return;
    }

    if (!(await signaler.tryAcquireLock({
      issueId: issue.uniqueId(),
      workerId: this.context.workerId,
      lockTimeoutSeconds: 3600
    }))) {
      console.log(chalk.yellow(`[Jira/${this.config.project_key}] Issue ${jiraIssue.key()} is being processed by another worker`));
      return;
    }

    try {
      const selectedRunner = this.context.selectRunner();
      console.log(chalk.cyan(`Selected runner: ${selectedRunner}`));

      const task = await createTask(this.context.sql, {
        title: issue.title(),
        description: `Jira Issue ${jiraIssue.key()} from ${this.config.project_key}`,
        status: 'processing',
        project_id: this.context.project.id,
        source_gitlab_issue: {
          id: issue.id(),
          key: jiraIssue.key(),
          project_key: this.config.project_key,
          title: issue.title(),
          updated_at: issue.updatedAt()
        }
      });
      console.log(chalk.green(`Created task ${task.id} for issue ${jiraIssue.key()}`));

      const session = await createSession(this.context.sql, {
        task_id: task.id,
        runner: selectedRunner
      });
      console.log(chalk.green(`Created session ${session.id} with runner ${selectedRunner}`));

      const workspaceDir = this.setupWorkspace(issue);
      const branchName = `issue/jira-${jiraIssue.key()}`;

      const runner = createRunner(selectedRunner);
      const iterator = runner.query({
        prompt: `You are working on Jira issue ${jiraIssue.key()}: ${issue.title()}

CRITICAL FIRST STEP:
- Your FIRST action must be to fetch and read the complete issue details from Jira
- Read and understand the COMPLETE issue description and ALL comments before doing anything else
- Do NOT proceed with any implementation until you've analyzed the full issue context

IMPORTANT INSTRUCTIONS:
- Do ONLY what is explicitly asked in the issue - no extra features, improvements, or refactoring
- You are currently on branch "${branchName}" - all your work should be done on this branch
- Avoid installing dependencies unless absolutely required for the task
- Be concise in your responses - focus on actions, not explanations

COMPLETION REQUIREMENTS (you MUST complete ALL of these):
1. Implement the required changes
2. Commit your changes with a clear commit message
3. Push the branch to remote: \`git push origin ${branchName}\`
4. In your final result, return a simple summary of what was done (1-2 sentences max)`,
        options: {
          permissionMode: 'bypassPermissions',
          env: process.env as Record<string, string>,
          executable: 'bun',
          cwd: workspaceDir,
          stderr: _data => {
            // Append to file
          },
          allowedTools: ['Bash(npm: *)', 'Bash(git: *)', 'Read', 'Write', 'Edit', 'Glob'],
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
              issue: jiraIssue,
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
      console.error(chalk.red(`[Jira/${this.config.project_key}] Error processing issue ${jiraIssue.key()}:`), error);
      await signaler.releaseLock(issue.uniqueId());
      throw error;
    }
  }

  private generateTelegramMessage(info: JiraCompletionInfo): string {
    const branchName = `issue/jira-${info.issue.key()}`;
    const issueUrl = `${this.config.host}/browse/${info.issue.key()}`;

    return `✅ <b>Issue Completed</b>

<a href="${issueUrl}">${info.issue.title()}</a>

Branch: <code>${branchName}</code>
Iterations: ${info.iterations} | Cost: $${info.cost.toFixed(4)}

<b>Result:</b>
${info.result}`;
  }
}
