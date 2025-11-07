import type { BaseTaskSource } from './base';
import { GitlabIssuesTaskSource } from './gitlab-issues';
import { JiraTaskSource } from './jira';
import { assertNever } from '@utils/assert-never';
import type { TaskSource } from "@types";

export function createTaskSource(taskSource: TaskSource): BaseTaskSource {
  switch (taskSource.type) {
    case 'gitlab_issues':
      return new GitlabIssuesTaskSource(taskSource);
    case 'jira':
      return new JiraTaskSource(taskSource);
    case 'github_issues':
      throw new Error('GithubIssuesTaskSource not yet implemented');
    default:
      assertNever(taskSource);
  }
}
