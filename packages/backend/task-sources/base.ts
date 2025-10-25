import {assertNever} from '@utils/assert-never';
import type {TaskSource, TaskSourceIssue} from "@types";

export abstract class BaseTaskSource {
  protected taskSource: TaskSource;
  protected config: Record<string, unknown>;

  constructor(taskSource: TaskSource) {
    if (taskSource.type === 'gitlab_issues') {
      if (!taskSource.config.repo || taskSource.config.repo.trim() === '') {
        throw new Error('GitLab task source requires non-empty repo in config');
      }
    } else if (taskSource.type === 'jira') {
      if (!taskSource.config.project_key || taskSource.config.project_key.trim() === '') {
        throw new Error('Jira task source requires non-empty project_key in config');
      }
      if (!taskSource.config.host || taskSource.config.host.trim() === '') {
        throw new Error('Jira task source requires non-empty host in config');
      }
    } else if (taskSource.type === 'github_issues') {
      if (!taskSource.config.repo || taskSource.config.repo.trim() === '') {
        throw new Error('GitHub task source requires non-empty repo in config');
      }
    } else {
      assertNever(taskSource);
    }

    this.taskSource = taskSource;
    this.config = taskSource.config;
  }

  abstract getIssues(): AsyncIterable<TaskSourceIssue>;
  abstract getIssueDetails(issueId: string): Promise<TaskSourceIssue>;

  /**
   * Optional method to revalidate issues by their IDs
   * Used to check if issues have been closed on the remote platform
   */
  revalidateIssues?(iids: number[]): AsyncIterable<TaskSourceIssue>;

  getId(): string {
    return this.taskSource.id;
  }

  getConfig(): Readonly<Record<string, unknown>> {
    return {...this.config};
  }
}
