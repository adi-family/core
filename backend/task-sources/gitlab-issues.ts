import {BaseTaskSource, type TaskSource, type TaskSourceIssue, type GitlabMetadata, type GitlabIssuesConfig} from './base';
import {getGitlabIssueList} from '../../gitlab';

export class GitlabIssuesTaskSource extends BaseTaskSource {
  private gitlabConfig: GitlabIssuesConfig;

  constructor(taskSource: TaskSource) {
    super(taskSource);
    if (taskSource.type !== 'gitlab_issues') {
      throw new Error('Invalid task source type for GitlabIssuesTaskSource');
    }
    this.gitlabConfig = taskSource.config;
  }

  async *getIssues(): AsyncIterable<TaskSourceIssue> {
    const issues = await getGitlabIssueList(
      this.gitlabConfig.repo,
      this.gitlabConfig.labels,
      this.gitlabConfig.host,
      this.gitlabConfig.access_token
    );
    for (const issue of issues) {
      const metadata: GitlabMetadata = {
        provider: 'gitlab',
        repo: this.gitlabConfig.repo,
        host: this.gitlabConfig.host
      };

      yield {
        id: issue.id(),
        iid: null,
        title: issue.title(),
        description: undefined,
        updatedAt: issue.updatedAt(),
        uniqueId: issue.uniqueId(),
        metadata
      };
    }
  }

  async getIssueDetails(_issueId: string): Promise<TaskSourceIssue> {
    throw new Error('getIssueDetails not implemented for GitlabIssuesTaskSource');
  }
}
