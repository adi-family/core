import {assertNever} from '@utils/assert-never';

export type GitlabMetadata = {
  provider: 'gitlab';
  repo: string;
  host?: string;
  iid?: number;
};

export type GithubMetadata = {
  provider: 'github';
  repo: string;
  host?: string;
};

export type JiraMetadata = {
  provider: 'jira';
  host: string;
  key: string;
  project_key: string;
};

export type IssueMetadata = GitlabMetadata | GithubMetadata | JiraMetadata;

export type TaskSourceIssue = {
  id: string;
  iid?: number | null;
  title: string;
  description?: string;
  updatedAt: string;
  uniqueId: string;
  metadata: IssueMetadata;
};

export type GitlabIssuesConfig = {
  repo: string;
  labels: string[];
  host?: string;
  access_token_secret_id?: string;
};

export type GithubIssuesConfig = {
  repo: string;
  labels?: string[];
  host?: string;
  access_token_secret_id?: string;
};

export type TaskSourceJiraConfig = {
  project_key: string;
  jql_filter?: string;
  host: string;
  access_token_secret_id?: string;
};

export type TaskSource = {
  id: string;
  project_id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
} & (
  | { type: 'gitlab_issues'; config: GitlabIssuesConfig }
  | { type: 'jira'; config: TaskSourceJiraConfig }
  | { type: 'github_issues'; config: GithubIssuesConfig }
);

export abstract class BaseTaskSource {
  protected taskSource: TaskSource;
  protected config: Record<string, unknown>;

  constructor(taskSource: TaskSource) {
    if (taskSource.type === 'gitlab_issues') {
      if (!taskSource.config.repo || taskSource.config.repo.trim() === '') {
        throw new Error('GitLab task source requires non-empty repo in config');
      }
    } else if (taskSource.type === 'jira') {
      if (!taskSource.config.project_key || taskSource.config.project_key.trim() === '') {
        throw new Error('Jira task source requires non-empty project_key in config');
      }
      if (!taskSource.config.host || taskSource.config.host.trim() === '') {
        throw new Error('Jira task source requires non-empty host in config');
      }
    } else if (taskSource.type === 'github_issues') {
      if (!taskSource.config.repo || taskSource.config.repo.trim() === '') {
        throw new Error('GitHub task source requires non-empty repo in config');
      }
    } else {
      assertNever(taskSource);
    }

    this.taskSource = taskSource;
    this.config = taskSource.config;
  }

  abstract getIssues(): AsyncIterable<TaskSourceIssue>;
  abstract getIssueDetails(issueId: string): Promise<TaskSourceIssue>;

  getId(): string {
    return this.taskSource.id;
  }

  getConfig(): Readonly<Record<string, unknown>> {
    return {...this.config};
  }
}
