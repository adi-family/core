import { assertNever } from '@utils/assert-never';
import type { TaskSource, TaskSourceConfig, TaskSourceIssue } from "@types";

export abstract class BaseTaskSource {
  protected taskSource: TaskSource;
  protected config: TaskSourceConfig;

  constructor(taskSource: TaskSource) {
    switch (taskSource.type) {
      case 'gitlab_issues':
        if (!taskSource.config.repo || taskSource.config.repo.trim() === '') {
          throw new Error('GitLab task source requires non-empty repo in config');
        }
        break;
      case 'jira':
        if (!taskSource.config.host || taskSource.config.host.trim() === '') {
          throw new Error('Jira task source requires non-empty host in config');
        }
        // project_key and jql_filter are both optional - will use default "resolution = Unresolved" if neither provided
        break;
      case 'github_issues':
        if (!taskSource.config.repo || taskSource.config.repo.trim() === '') {
          throw new Error('GitHub task source requires non-empty repo in config');
        }
        break;
      default:
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
    return { ...this.config };
  }
}
