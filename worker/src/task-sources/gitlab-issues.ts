import {BaseTaskSource, type TaskSource, type TaskSourceIssue} from './base';
import {getGitlabIssueList} from '../gitlab';

export type GitlabIssuesConfig = {
  repo: string;
  labels: string[];
  host?: string;
};

export class GitlabIssuesTaskSource extends BaseTaskSource {
  private gitlabConfig: GitlabIssuesConfig;

  constructor(taskSource: TaskSource) {
    super(taskSource);
    this.gitlabConfig = taskSource.config as GitlabIssuesConfig;
  }

  async *getIssues(): AsyncIterable<TaskSourceIssue> {
    const issues = getGitlabIssueList(this.gitlabConfig.repo, this.gitlabConfig.labels);
    for (const issue of issues) {
      yield {
        id: issue.id(),
        iid: null,
        title: issue.title(),
        description: undefined,
        updatedAt: issue.updatedAt(),
        uniqueId: issue.uniqueId(),
        metadata: {
          provider: issue.provider(),
          repo: this.gitlabConfig.repo
        }
      };
    }
  }

  async getIssueDetails(issueId: string): Promise<TaskSourceIssue> {
    throw new Error('getIssueDetails not implemented for GitlabIssuesTaskSource');
  }
}
