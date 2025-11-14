import { BaseTaskSource } from './base';
import { sql } from '@db/client.ts';
import { getSecretWithMetadata } from '../services/secrets';
import { GitHubApiClient } from '@shared/github-api-client';
import type { GithubIssuesConfig, GithubMetadata, TaskSource, TaskSourceIssue } from "@types";

export class GithubIssuesTaskSource extends BaseTaskSource {
  private githubConfig: GithubIssuesConfig;

  constructor(taskSource: TaskSource) {
    super(taskSource);
    if (taskSource.type !== 'github_issues') {
      throw new Error('Invalid task source type for GithubIssuesTaskSource');
    }
    this.githubConfig = taskSource.config;
  }

  private async getClient(): Promise<GitHubApiClient> {
    let accessToken: string | undefined;

    if (this.githubConfig.access_token_secret_id) {
      try {
        const secretData = await getSecretWithMetadata(sql, this.githubConfig.access_token_secret_id);
        accessToken = secretData.value;
      } catch (error) {
        console.error('Failed to decrypt GitHub access token:', error);
        throw new Error('GitHub access token is required but could not be retrieved');
      }
    }

    if (!accessToken) {
      throw new Error('GitHub access token is required');
    }

    const host = this.githubConfig.host || 'https://api.github.com';
    return new GitHubApiClient(accessToken, host);
  }

  async *getIssues(): AsyncIterable<TaskSourceIssue> {
    const client = await this.getClient();
    const [owner, repo] = this.githubConfig.repo.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repository format: ${this.githubConfig.repo}. Expected format: owner/repo`);
    }

    // Fetch issues with optional label filtering
    const issues = await client.listIssues(owner, repo, {
      state: 'open',
      labels: this.githubConfig.labels || [],
      per_page: 100,
    });

    for (const issue of issues) {
      const metadata: GithubMetadata = {
        provider: 'github',
        repo: this.githubConfig.repo,
        host: this.githubConfig.host,
      };

      yield {
        id: String(issue.number),
        iid: issue.number,
        title: issue.title,
        description: issue.body || undefined,
        updatedAt: issue.updated_at,
        uniqueId: `github-${this.githubConfig.repo}-${issue.number}`,
        metadata,
        state: issue.state === 'open' ? 'opened' : 'closed',
      };
    }
  }

  async getIssueDetails(issueId: string): Promise<TaskSourceIssue> {
    const client = await this.getClient();
    const [owner, repo] = this.githubConfig.repo.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repository format: ${this.githubConfig.repo}. Expected format: owner/repo`);
    }

    const issueNumber = parseInt(issueId, 10);
    if (isNaN(issueNumber)) {
      throw new Error(`Invalid issue ID: ${issueId}`);
    }

    const issue = await client.getIssue(owner, repo, issueNumber);

    const metadata: GithubMetadata = {
      provider: 'github',
      repo: this.githubConfig.repo,
      host: this.githubConfig.host,
    };

    return {
      id: String(issue.number),
      iid: issue.number,
      title: issue.title,
      description: issue.body || undefined,
      updatedAt: issue.updated_at,
      uniqueId: `github-${this.githubConfig.repo}-${issue.number}`,
      metadata,
      state: issue.state === 'open' ? 'opened' : 'closed',
    };
  }

  /**
   * Revalidate issues by their numbers - fetches current status from GitHub
   * Used to detect closed issues
   */
  override async *revalidateIssues(issueNumbers: number[]): AsyncIterable<TaskSourceIssue> {
    if (!issueNumbers || issueNumbers.length === 0) {
      return;
    }

    const client = await this.getClient();
    const [owner, repo] = this.githubConfig.repo.split('/');

    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repository format: ${this.githubConfig.repo}. Expected format: owner/repo`);
    }

    for (const issueNumber of issueNumbers) {
      try {
        const issue = await client.getIssue(owner, repo, issueNumber);

        const metadata: GithubMetadata = {
          provider: 'github',
          repo: this.githubConfig.repo,
          host: this.githubConfig.host,
        };

        yield {
          id: String(issue.number),
          iid: issue.number,
          title: issue.title,
          description: issue.body || undefined,
          updatedAt: issue.updated_at,
          uniqueId: `github-${this.githubConfig.repo}-${issue.number}`,
          metadata,
          state: issue.state === 'open' ? 'opened' : 'closed',
        };
      } catch (error) {
        console.error(`Failed to revalidate GitHub issue #${issueNumber}:`, error);
        // Continue with next issue
      }
    }
  }
}
