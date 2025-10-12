import {BaseProjectProcessor, type ProcessorContext} from './base';
import type {TaskSourceIssue} from '../task-sources/base';
import type {BaseFileSpace} from '../file-spaces/base';
import {initTrafficLight} from '../cache';
import {createTask, createSession, createMessage, updateTaskStatus, addTaskFileSpaces} from '../queries';
import {createRunner} from '../runners';
import {assertNever} from '../utils/assert-never';
import * as path from 'path';
import chalk from 'chalk';


export class GenericProjectProcessor extends BaseProjectProcessor {
  constructor(context: ProcessorContext) {
    super(context);
  }

  async processIssues(): Promise<void> {
    for await (const issue of this.taskSource.getIssues()) {
      await this.processIssue(issue);
    }
  }

  async processIssue(issue: TaskSourceIssue): Promise<void> {
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

    if (!(await signaler.tryAcquireLock({
      issueId: issue.uniqueId,
      workerId: this.context.workerId,
      lockTimeoutSeconds: 3600
    }))) {
      console.log(
        chalk.yellow(
          `[${this.context.project.name}] Issue ${issue.id} is being processed by another worker`
        )
      );
      return;
    }

    try {
      const fileSpaces = this.context.fileSpaces;

      if (fileSpaces.length === 0) {
        throw new Error(
          `No file spaces available for project '${this.context.project.name}' (${this.context.project.id}). ` +
          'Ensure at least one enabled file space is configured for this project.'
        );
      }

      console.log(chalk.blue(`Processing issue with ${fileSpaces.length} file space(s)`));

      const selectedRunner = this.context.selectRunner();
      console.log(chalk.cyan(`Selected runner: ${selectedRunner}`));

      const task = await createTask(this.context.sql, {
        title: issue.title,
        description: `Issue #${issue.id} from ${this.context.project.name}`,
        status: 'processing',
        project_id: this.context.project.id,
        task_source_id: this.taskSource.getId(),
        source_gitlab_issue: {
          id: issue.id,
          iid: issue.iid,
          title: issue.title,
          updated_at: issue.updatedAt,
          metadata: issue.metadata
        }
      });
      console.log(chalk.green(`Created task ${task.id} for issue ${issue.id}`));

      await addTaskFileSpaces(
        this.context.sql,
        task.id,
        fileSpaces.map(fs => fs.getId())
      );
      console.log(chalk.green(`Associated ${fileSpaces.length} file space(s) with task ${task.id}`));

      const session = await createSession(this.context.sql, {
        task_id: task.id,
        runner: selectedRunner
      });
      console.log(chalk.green(`Created session ${session.id} with runner ${selectedRunner}`));

      const taskDir = path.join(this.context.appsDir, `task-${task.id}`);
      const branchName = `issue/${issue.metadata.provider}-${issue.id}`;

      // Clone and prepare all file spaces
      const fileSpaceInfos: Array<{name: string; path: string}> = [];
      for (const fileSpace of fileSpaces) {
        const fileSpaceName = fileSpace.getId().substring(0, 8); // Use first 8 chars of ID as folder name
        const workspaceDir = path.join(taskDir, fileSpaceName);

        console.log(chalk.gray(`Cloning file space ${fileSpaceName} to ${workspaceDir}`));
        await fileSpace.clone(workspaceDir);

        const location = {workDir: workspaceDir, workspaceName: branchName};
        const branchExists = await fileSpace.workspaceExists(location);
        if (branchExists) {
          await fileSpace.switchToWorkspace(location);
        } else {
          await fileSpace.createWorkspace(location);
        }

        fileSpaceInfos.push({
          name: fileSpaceName,
          path: workspaceDir
        });
      }

      const issueViewCommand = this.getIssueViewCommand(issue);

      // Prepare repository information for the prompt
      const repoInfo = fileSpaceInfos.length > 1
        ? `\n\nREPOSITORIES:
You have access to ${fileSpaceInfos.length} repositories:
${fileSpaceInfos.map((info, idx) => `${idx + 1}. ${info.path}`).join('\n')}

All repositories are on branch "${branchName}".`
        : '';

      const runner = createRunner(selectedRunner);
      const iterator = runner.query({
        prompt: `You are working on issue #${issue.id}: ${issue.title}

CRITICAL FIRST STEP:
${issueViewCommand ? `- Your FIRST action must be: \`${issueViewCommand}\`` : '- Fetch and read the complete issue details'}
- Read and understand the COMPLETE issue description and ALL comments before doing anything else
- Do NOT proceed with any implementation until you've analyzed the full issue context
${repoInfo}

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
        options: {
          permissionMode: 'bypassPermissions',
          env: process.env as Record<string, string>,
          executable: 'bun',
          cwd: taskDir,
          stderr: _data => {
            // Append to file
          },
          allowedTools: ['Bash(npm: *)', 'Bash(glab: *)', 'Bash(gh: *)', 'Bash(git: *)', 'Read', 'Write', 'Edit', 'Glob']
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
            issueId: issue.uniqueId,
            date: new Date(),
            taskId: task.id
          });
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

  private getIssueViewCommand(issue: TaskSourceIssue): string | null {
    switch (issue.metadata.provider) {
      case 'gitlab':
        return `glab issue view ${issue.id}`;
      case 'github':
        return `gh issue view ${issue.id}`;
      case 'jira':
        return null;
      default:
        assertNever(issue.metadata);
        return null;
    }
  }

}
