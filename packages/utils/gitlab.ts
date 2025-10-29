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
  state?: 'opened' | 'closed' | 'all'
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

  const gitlab = new Gitlab({
    token,
    host: host || 'https://gitlab.com'
  });

  const issues = await gitlab.Issues.all({
    projectId: repo,
    state: state || 'opened'
  });

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
  accessToken?: string
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

  const gitlab = new Gitlab({
    token,
    host: host || 'https://gitlab.com'
  });

  // GitLab API supports iids parameter for batch fetching
  const issues = await gitlab.Issues.all({
    projectId: repo,
    iids: iids,
    state: 'all' // Fetch both opened and closed to verify status
  });

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
