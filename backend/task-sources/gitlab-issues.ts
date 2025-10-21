import {BaseTaskSource} from './base';
import {getGitlabIssueList} from '../../gitlab';
import {sql} from '@db/client.ts';
import {findSecretById} from '@db/secrets.ts';
import type {GitlabIssuesConfig, GitlabMetadata, TaskSource, TaskSourceIssue} from "@types";

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
    let accessToken: string | undefined;

    if (this.gitlabConfig.access_token_secret_id) {
      const secretResult = await findSecretById(sql, this.gitlabConfig.access_token_secret_id);
      if (secretResult.ok) {
        accessToken = secretResult.data.value;
      }
    }

    const issues = await getGitlabIssueList(
      this.gitlabConfig.repo,
      this.gitlabConfig.labels,
      this.gitlabConfig.host,
      accessToken
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
