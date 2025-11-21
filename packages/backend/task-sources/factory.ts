import type { BaseTaskSource } from './base';
import { GitlabIssuesTaskSource } from './gitlab-issues';
import { GithubIssuesTaskSource } from './github-issues';
import { JiraTaskSource } from './jira';
import { assertNever } from '@utils/assert-never';
import type { TaskSource } from "@types";
import { TASK_SOURCE_TYPES } from '@config/shared';

export function createTaskSource(taskSource: TaskSource): BaseTaskSource {
  switch (taskSource.type) {
    case TASK_SOURCE_TYPES[0]: // 'gitlab_issues'
      return new GitlabIssuesTaskSource(taskSource);
    case TASK_SOURCE_TYPES[1]: // 'github_issues'
      return new GithubIssuesTaskSource(taskSource);
    case TASK_SOURCE_TYPES[2]: // 'jira'
      return new JiraTaskSource(taskSource);
    case 'manual':
      throw new Error('Manual task sources do not support syncing operations');
    default:
      assertNever(taskSource);
  }
}
