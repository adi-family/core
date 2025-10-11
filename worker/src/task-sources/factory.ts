import {BaseTaskSource, type TaskSource} from './base';
import {GitlabIssuesTaskSource} from './gitlab-issues';
import {JiraTaskSource} from './jira';

export function createTaskSource(taskSource: TaskSource): BaseTaskSource {
  switch (taskSource.type) {
    case 'gitlab_issues':
      return new GitlabIssuesTaskSource(taskSource);
    case 'jira':
      return new JiraTaskSource(taskSource);
    case 'github_issues':
      throw new Error('GithubIssuesTaskSource not yet implemented');
    default:
      throw new Error(`Unknown task source type: ${taskSource.type}`);
  }
}
