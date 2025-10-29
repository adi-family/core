import {BaseTaskSource} from './base';
import {getGitlabIssueList, getGitlabIssuesByIids} from '@utils/gitlab';
import {sql} from '@db/client.ts';
import {getDecryptedSecretValue} from '../services/secrets';
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
      try {
        accessToken = await getDecryptedSecretValue(sql, this.gitlabConfig.access_token_secret_id);
      } catch (error) {
        console.error('Failed to decrypt GitLab access token:', error);
        // Continue without token - will use public API if available
      }
    }

    const issues = await getGitlabIssueList(
      this.gitlabConfig.repo,
      this.gitlabConfig.host,
      accessToken
    );
    for (const issue of issues) {
      const metadata: GitlabMetadata = {
        provider: 'gitlab',
        repo: this.gitlabConfig.repo,
        host: this.gitlabConfig.host,
        iid: issue.iid()
      };

      yield {
        id: issue.id(),
        iid: issue.iid(),
        title: issue.title(),
        description: issue.description() || undefined,
        updatedAt: issue.updatedAt(),
        uniqueId: issue.uniqueId(),
        metadata,
        state: issue.state()
      };
    }
  }

  async getIssueDetails(_issueId: string): Promise<TaskSourceIssue> {
    throw new Error('getIssueDetails not implemented for GitlabIssuesTaskSource');
  }

  /**
   * Revalidate issues by IIDs - fetches current status from GitLab
   * Used to detect closed issues
   */
  override async *revalidateIssues(iids: number[]): AsyncIterable<TaskSourceIssue> {
    if (!iids || iids.length === 0) {
      return;
    }

    let accessToken: string | undefined;

    if (this.gitlabConfig.access_token_secret_id) {
      try {
        accessToken = await getDecryptedSecretValue(sql, this.gitlabConfig.access_token_secret_id);
      } catch (error) {
        console.error('Failed to decrypt GitLab access token:', error);
      }
    }

    const issues = await getGitlabIssuesByIids(
      this.gitlabConfig.repo,
      iids,
      this.gitlabConfig.host,
      accessToken
    );

    for (const issue of issues) {
      const metadata: GitlabMetadata = {
        provider: 'gitlab',
        repo: this.gitlabConfig.repo,
        host: this.gitlabConfig.host,
        iid: issue.iid()
      };

      yield {
        id: issue.id(),
        iid: issue.iid(),
        title: issue.title(),
        description: issue.description() || undefined,
        updatedAt: issue.updatedAt(),
        uniqueId: issue.uniqueId(),
        metadata,
        state: issue.state()
      };
    }
  }
}
