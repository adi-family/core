import {BaseProjectProcessor, type ProcessorContext} from './base';
import type {TaskSourceIssue} from '../task-sources/base';
import {initTrafficLight} from '../cache';
import {createTask, createSession, createMessage, updateTaskStatus, addTaskFileSpaces} from '../queries';
import {createRunner} from '../runners';
import {triggerPipeline} from '../pipeline-executor';
import {assertNever} from '@utils/assert-never';
import * as path from 'path';
import {createLogger} from '../../utils/logger';


export class GenericProjectProcessor extends BaseProjectProcessor {
  private logger = createLogger({ namespace: 'GenericProjectProcessor' });

  constructor(context: ProcessorContext) {
    super(context);
  }

  async processIssues(): Promise<void> {
    for await (const issue of this.taskSource.getIssues()) {
      await this.processIssue(issue);
    }
  }

  async processIssue(issue: TaskSourceIssue): Promise<void> {
    // Use API client if available, otherwise fall back to direct DB access
    const signaler = initTrafficLight(
      this.context.apiClient || this.context.sql,
      this.context.project.id
    );

    this.logger.info(`[${this.context.project.name}] New or updated issue: ${issue.title}`);

    if (await signaler.isSignaledBefore(issue.uniqueId, issue.updatedAt)) {
      this.logger.debug(
        `[${this.context.project.name}] Skipping already processed issue: ${issue.title}`
      );
      return;
    }

    if (!(await signaler.tryAcquireLock({
      issueId: issue.uniqueId,
      workerId: this.context.workerId,
      lockTimeoutSeconds: 3600
    }))) {
      this.logger.warn(
        `[${this.context.project.name}] Issue ${issue.id} is being processed by another worker`
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

      this.logger.info(`Processing issue with ${fileSpaces.length} file space(s)`);

      const selectedRunner = this.context.selectRunner();
      this.logger.info(`Selected runner: ${selectedRunner}`);

      const getSourceIssue = () => {
        switch (issue.metadata.provider) {
          case 'gitlab':
            return {
              source_gitlab_issue: {
                id: issue.id,
                iid: issue.iid,
                title: issue.title,
                updated_at: issue.updatedAt,
                metadata: issue.metadata
              }
            };
          case 'github':
            return {
              source_github_issue: {
                id: issue.id,
                iid: issue.iid,
                title: issue.title,
                updated_at: issue.updatedAt,
                metadata: issue.metadata
              }
            };
          case 'jira':
            return {
              source_jira_issue: {
                id: issue.id,
                title: issue.title,
                updated_at: issue.updatedAt,
                metadata: issue.metadata
              }
            };
          default:
            assertNever(issue.metadata);
            return {};
        }
      };

      const task = await createTask(this.context.sql, {
        title: issue.title,
        description: `Issue #${issue.id} from ${this.context.project.name}`,
        status: 'processing',
        project_id: this.context.project.id,
        task_source_id: this.taskSource.getId(),
        ...getSourceIssue()
      });
      this.logger.success(`Created task ${task.id} for issue ${issue.id}`);

      await addTaskFileSpaces(
        this.context.sql,
        task.id,
        fileSpaces.map(fs => fs.getId())
      );
      this.logger.success(`Associated ${fileSpaces.length} file space(s) with task ${task.id}`);

      const session = await createSession(this.context.sql, {
        task_id: task.id,
        runner: selectedRunner
      });
      this.logger.success(`Created session ${session.id} with runner ${selectedRunner}`);

      // Check if pipeline execution mode is enabled
      const usePipelineExecution = process.env.USE_PIPELINE_EXECUTION === 'true';

      if (usePipelineExecution) {
        this.logger.info('🚀 Pipeline execution mode enabled');

        try {
          if (!this.context.apiClient) {
            throw new Error('API client is required for pipeline execution mode');
          }
          const result = await triggerPipeline({
            sessionId: session.id,
            apiClient: this.context.apiClient
          });

          this.logger.success(`✅ Pipeline triggered successfully!`);
          this.logger.info(`   Pipeline URL: ${result.pipelineUrl}`);
          this.logger.info(`   Execution ID: ${result.execution.id}`);
          this.logger.debug(`   Status will be updated by pipeline or monitor`);

          // Mark issue as signaled to prevent reprocessing
          await signaler.signal({
            issueId: issue.uniqueId,
            date: new Date(),
            taskId: task.id
          });

          return; // Exit early - pipeline will handle the rest
        } catch (error) {
          this.logger.error(`❌ Failed to trigger pipeline:`, error);
          await updateTaskStatus(this.context.sql, task.id, 'failed');
          throw error;
        }
      }

      // Local execution mode (existing code)
      this.logger.info('🖥️  Local execution mode');

      const taskDir = path.join(this.context.appsDir, `task-${task.id}`);
      const branchName = `issue/${issue.metadata.provider}-${issue.id}`;

      // Clone and prepare all file spaces
      const fileSpaceInfos: Array<{name: string; path: string}> = [];
      for (const fileSpace of fileSpaces) {
        const fileSpaceName = fileSpace.getId().substring(0, 8); // Use first 8 chars of ID as folder name
        const workspaceDir = path.join(taskDir, fileSpaceName);

        this.logger.debug(`Cloning file space ${fileSpaceName} to ${workspaceDir}`);
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

      const runner = createRunner(selectedRunner);
      const iterator = runner.run({
        issue,
        branchName,
        taskDir,
        fileSpaceInfos,
        issueViewCommand: this.getIssueViewCommand(issue),
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

      for await (const chunk of iterator) {
        await createMessage(this.context.sql, {
          session_id: session.id,
          data: chunk
        });

        if (chunk.type === 'result') {
          await updateTaskStatus(this.context.sql, task.id, 'completed');
          await signaler.signal({
            issueId: issue.uniqueId,
            date: new Date(),
            taskId: task.id
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `[${this.context.project.name}] Error processing issue ${issue.id}:`,
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
