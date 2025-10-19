import {execSync} from "child_process";
import {Issue} from "./issue";

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

  public updatedAt(): Date {
    return new Date(this.issue.updated_at);
  }
}

export function getGitlabIssueList(repo: string, labels: string[] = ['DOIT']): GitlabIssueMinimalList[] {
  if (!repo || repo.trim() === '') {
    throw new Error('GitLab repo is required and cannot be empty');
  }
  if (!repo.includes('/')) {
    throw new Error('GitLab repo must be in format owner/name (e.g., gitlab-org/gitlab)');
  }
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error('GitLab labels must be a non-empty array');
  }

  const labelArgs = labels.map(l => `-l ${l}`).join(' ');
  const res = execSync(`glab issue list -R ${repo} -O json ${labelArgs} -a @me --all`, { encoding: 'utf-8' });
  return (JSON.parse(res) as GitlabIssueListMinimal[]).map(v => new GitlabIssueMinimalList(v));
}
