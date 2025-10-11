import {execSync} from "child_process";
import {Issue} from "./issue";

export interface GitlabIssueListMinimal {
  id: number;
  iid: number;
  state: 'opened' | 'closed';
  description: string;
  title: string;
  updated_at: string;

  // There are more, but we only care about these fields for now
}

export class GitlabIssueMinimalList extends Issue {
  constructor(
    private issue: GitlabIssueListMinimal,
  ) {
    super();
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

export function getGitlabIssueList(repo: string): GitlabIssueMinimalList[] {
  const res = execSync(`glab issue list -R ${repo} -O json -l DOIT -a @me --all`, { encoding: 'utf-8' });
  return (JSON.parse(res) as GitlabIssueListMinimal[]).map(v => new GitlabIssueMinimalList(v));
}
