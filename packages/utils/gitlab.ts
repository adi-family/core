import { Gitlab } from '@gitbeaker/rest';
import { Issue } from "./issue";

export interface GitlabIssueListMinimal {
  id: number;
  iid: number;
  state: 'opened' | 'closed';
  description: string;
  title: string;
  updated_at: string;
}

export class GitlabIssueMinimalList extends Issue {
  private issue: GitlabIssueListMinimal;

  constructor(issue: GitlabIssueListMinimal) {
    super();
    this.issue = issue;
  }

  public provider(): string {
    return 'gitlab';
  }

  public id(): string {
    return this.issue.id.toString();
  }

  public title(): string {
    return this.issue.title;
  }

  public updatedAt(): string {
    return this.issue.updated_at;
  }

  public iid(): number {
    return this.issue.iid;
  }

  public description(): string {
    return this.issue.description;
  }

  public state(): 'opened' | 'closed' {
    return this.issue.state;
  }
}

export async function getGitlabIssueList(
  repo: string,
  host?: string,
  accessToken?: string,
  state?: 'opened' | 'closed' | 'all',
  tokenType?: 'oauth' | 'api' | null
): Promise<GitlabIssueMinimalList[]> {
  if (!repo || repo.trim() === '') {
    throw new Error('GitLab repo is required and cannot be empty');
  }
  if (!repo.includes('/')) {
    throw new Error('GitLab repo must be in format owner/name (e.g., gitlab-org/gitlab)');
  }

  const token = accessToken || process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error('GitLab access token is required. Either provide it in the task source config or set GITLAB_TOKEN environment variable.');
  }

  const baseHost = (host || 'https://gitlab.com').replace(/\/$/, '');
  const encodedRepo = encodeURIComponent(repo);
  const url = `${baseHost}/api/v4/projects/${encodedRepo}/issues?state=${state || 'opened'}`;

  // Use proper authentication header based on token type
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (tokenType === 'oauth') {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['PRIVATE-TOKEN'] = token;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }

  const issues = await response.json() as unknown[];

  return issues.map((issue: unknown) => {
    const i = issue as GitlabIssueListMinimal;
    return new GitlabIssueMinimalList({
      id: i.id,
      iid: i.iid,
      state: i.state,
      description: i.description || '',
      title: i.title,
      updated_at: i.updated_at
    });
  });
}

/**
 * Batch fetch GitLab issues by IIDs to verify their current status
 * Optimized for revalidation - fetches all issues (opened or closed)
 */
export async function getGitlabIssuesByIids(
  repo: string,
  iids: number[],
  host?: string,
  accessToken?: string,
  tokenType?: 'oauth' | 'api' | null
): Promise<GitlabIssueMinimalList[]> {
  if (!repo || repo.trim() === '') {
    throw new Error('GitLab repo is required and cannot be empty');
  }
  if (!repo.includes('/')) {
    throw new Error('GitLab repo must be in format owner/name (e.g., gitlab-org/gitlab)');
  }
  if (!iids || iids.length === 0) {
    return [];
  }

  const token = accessToken || process.env.GITLAB_TOKEN;
  if (!token) {
    throw new Error('GitLab access token is required. Either provide it in the task source config or set GITLAB_TOKEN environment variable.');
  }

  const baseHost = (host || 'https://gitlab.com').replace(/\/$/, '');
  const encodedRepo = encodeURIComponent(repo);
  const iidsParam = iids.map(iid => `iids[]=${iid}`).join('&');
  const url = `${baseHost}/api/v4/projects/${encodedRepo}/issues?state=all&${iidsParam}`;

  // Use proper authentication header based on token type
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (tokenType === 'oauth') {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['PRIVATE-TOKEN'] = token;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
  }

  const issues = await response.json() as unknown[];

  return issues.map((issue: unknown) => {
    const i = issue as GitlabIssueListMinimal;
    return new GitlabIssueMinimalList({
      id: i.id,
      iid: i.iid,
      state: i.state,
      description: i.description || '',
      title: i.title,
      updated_at: i.updated_at
    });
  });
}
