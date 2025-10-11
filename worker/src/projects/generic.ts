import {BaseProjectProcessor, type ProcessorContext} from './base';
import type {TaskSourceIssue} from '../task-sources/base';
import {initTrafficLight} from '../cache';
import {createTask, createSession, createMessage, updateTaskStatus} from '../queries';
import {createRunner} from '../runners';
import {sendTelegramMessage} from '../telegram';
import * as path from 'path';
import chalk from 'chalk';

export class GenericProjectProcessor extends BaseProjectProcessor {
  constructor(context: ProcessorContext) {
    super(context);
  }

  async processIssues(): Promise<void> {
    for await (const issue of this.taskSource.getIssues()) {
      const fileSpace = this.selectFileSpace();
      await this.processIssue(issue, fileSpace);
    }
  }

  async processIssue(issue: TaskSourceIssue, fileSpace: import('../file-spaces/base').BaseFileSpace): Promise<void> {
    const signaler = initTrafficLight(this.context.project.id);

    console.log(
      chalk.blue.bold(`[${this.context.project.name}] New or updated issue:`),
      issue.title
    );

    if (await signaler.isSignaledBefore(issue.uniqueId, issue.updatedAt)) {
      console.log(
        chalk.gray(
          `[${this.context.project.name}] Skipping already processed issue: ${issue.title}`
        )
      );
      return;
    }

    if (!(await signaler.tryAcquireLock(issue.uniqueId, this.context.workerId, 3600))) {
      console.log(
        chalk.yellow(
          `[${this.context.project.name}] Issue ${issue.id} is being processed by another worker`
        )
      );
      return;
    }

    try {
      const selectedRunner = this.context.selectRunner();
      console.log(chalk.cyan(`Selected runner: ${selectedRunner}`));

      const task = await createTask(this.context.sql, {
        title: issue.title,
        description: `Issue #${issue.id} from ${this.context.project.name}`,
        status: 'processing',
        project_id: this.context.project.id,
        task_source_id: this.taskSource.getId(),
        file_space_id: fileSpace.getId(),
        source_gitlab_issue: {
          id: issue.id,
          iid: issue.iid,
          title: issue.title,
          updated_at: issue.updatedAt,
          metadata: issue.metadata
        }
      });
      console.log(chalk.green(`Created task ${task.id} for issue ${issue.id}`));

      const session = await createSession(this.context.sql, {
        task_id: task.id,
        runner: selectedRunner
      });
      console.log(chalk.green(`Created session ${session.id} with runner ${selectedRunner}`));

      const workspaceDir = path.join(this.context.appsDir, `task-${task.id}`);
      const branchName = `issue/${issue.metadata.provider || 'unknown'}-${issue.id}`;

      await fileSpace.clone(workspaceDir);

      const branchExists = await fileSpace.workspaceExists(workspaceDir, branchName);
      if (branchExists) {
        await fileSpace.switchToWorkspace(workspaceDir, branchName);
      } else {
        await fileSpace.createWorkspace(workspaceDir, branchName);
      }

      const provider = (issue.metadata.provider as string) || 'unknown';
      const issueViewCommand = this.getIssueViewCommand(provider, issue);

      const runner = createRunner(selectedRunner);
      const iterator = runner.query(
        `You are working on issue #${issue.id}: ${issue.title}

CRITICAL FIRST STEP:
${issueViewCommand ? `- Your FIRST action must be: \`${issueViewCommand}\`` : '- Fetch and read the complete issue details'}
- Read and understand the COMPLETE issue description and ALL comments before doing anything else
- Do NOT proceed with any implementation until you've analyzed the full issue context

IMPORTANT INSTRUCTIONS:
- Do ONLY what is explicitly asked in the issue - no extra features, improvements, or refactoring
- You are currently on branch "${branchName}" - all your work should be done on this branch
- Avoid installing dependencies (npm install) unless absolutely required for the task
- Use npm for package management (no other package managers)
- Be concise in your responses - focus on actions, not explanations

COMPLETION REQUIREMENTS (you MUST complete ALL of these):
1. Implement the required changes
2. Commit your changes with a clear commit message
3. Push the branch to remote: \`git push origin ${branchName}\`
4. In your final result, return a simple summary of what was done (1-2 sentences max)`,
        {
          permissionMode: 'bypassPermissions',
          env: process.env as Record<string, string>,
          executable: 'bun',
          cwd: workspaceDir,
          stderr: data => {
            // Append to file
          },
          allowedTools: ['Bash(npm: *)', 'Bash(glab: *)', 'Bash(gh: *)', 'Bash(git: *)', 'Read', 'Write', 'Edit', 'Glob']
        }
      );

      let iterations = 0;
      let finalCost = 0;
      for await (const chunk of iterator) {
        iterations++;

        await createMessage(this.context.sql, {
          session_id: session.id,
          data: chunk
        });

        if (chunk.type === 'result') {
          finalCost = chunk.total_cost_usd || 0;
          const resultText =
            ('result' in chunk ? chunk?.result : undefined) || 'No result available';

          await updateTaskStatus(this.context.sql, task.id, 'completed');
          await signaler.signal(issue.uniqueId, new Date(), task.id);

          try {
            console.log(chalk.yellow('Sending Telegram notification...'));
            const message = this.generateTelegramMessage(
              issue,
              branchName,
              resultText,
              finalCost,
              iterations
            );
            await sendTelegramMessage(this.context.telegramConfig, {text: message});
            console.log(chalk.green('Telegram notification sent!'));
          } catch (error) {
            console.error(chalk.red('Failed to send Telegram notification:'), error);
          }
        }
      }
    } catch (error) {
      console.error(
        chalk.red(`[${this.context.project.name}] Error processing issue ${issue.id}:`),
        error
      );
      await signaler.releaseLock(issue.uniqueId);
      throw error;
    }
  }

  private getIssueViewCommand(provider: string, issue: TaskSourceIssue): string | null {
    switch (provider) {
      case 'gitlab':
        return `glab issue view ${issue.id}`;
      case 'github':
        return `gh issue view ${issue.id}`;
      case 'jira':
        return null;
      default:
        return null;
    }
  }

  private generateTelegramMessage(
    issue: TaskSourceIssue,
    branchName: string,
    result: string,
    cost: number,
    iterations: number
  ): string {
    const issueUrl = this.getIssueUrl(issue);

    return `✅ <b>Issue Completed</b>

<a href="${issueUrl}">${issue.title}</a>

Branch: <code>${branchName}</code>
Iterations: ${iterations} | Cost: $${cost.toFixed(4)}

<b>Result:</b>
${result}`;
  }

  private getIssueUrl(issue: TaskSourceIssue): string {
    const provider = (issue.metadata.provider as string) || 'unknown';
    const repo = issue.metadata.repo as string;
    const host = issue.metadata.host as string;

    switch (provider) {
      case 'gitlab':
        return `${host || 'https://gitlab.com'}/${repo}/-/issues/${issue.id}`;
      case 'github':
        return `${host || 'https://github.com'}/${repo}/issues/${issue.id}`;
      case 'jira':
        return `${host}/browse/${issue.metadata.key}`;
      default:
        return '#';
    }
  }
}
