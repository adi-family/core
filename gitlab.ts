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
}

export async function getGitlabIssueList(
  repo: string,
  labels: string[] = ['DOIT'],
  host?: string,
  accessToken?: string
): Promise<GitlabIssueMinimalList[]> {
  if (!repo || repo.trim() === '') {
    throw new Error('GitLab repo is required and cannot be empty');
  }
  if (!repo.includes('/')) {
    throw new Error('GitLab repo must be in format owner/name (e.g., gitlab-org/gitlab)');
  }
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error('GitLab labels must be a non-empty array');
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
    labels: labels.join(','),
    scope: 'assigned_to_me',
    state: 'opened'
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
