import type { BaseTaskSource } from './base';
import { GitlabIssuesTaskSource } from './gitlab-issues';
import { GithubIssuesTaskSource } from './github-issues';
import { JiraTaskSource } from './jira';
import { assertNever } from '@utils/assert-never';
import type { TaskSource } from "@types";

export function createTaskSource(taskSource: TaskSource): BaseTaskSource {
  switch (taskSource.type) {
    case 'gitlab_issues':
      return new GitlabIssuesTaskSource(taskSource);
    case 'github_issues':
      return new GithubIssuesTaskSource(taskSource);
    case 'jira':
      return new JiraTaskSource(taskSource);
    case 'manual':
      throw new Error('Manual task sources do not support syncing operations');
    default:
      assertNever(taskSource);
  }
}
