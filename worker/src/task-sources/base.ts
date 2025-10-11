export type TaskSourceIssue = {
  id: string;
  iid?: number | null;
  title: string;
  description?: string;
  updatedAt: Date;
  uniqueId: string;
  metadata: Record<string, unknown>;
};

export type TaskSource = {
  id: string;
  project_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export abstract class BaseTaskSource {
  protected taskSource: TaskSource;
  protected config: Record<string, unknown>;

  constructor(taskSource: TaskSource) {
    this.taskSource = taskSource;
    this.config = taskSource.config;
  }

  abstract getIssues(): AsyncIterable<TaskSourceIssue>;
  abstract getIssueDetails(issueId: string): Promise<TaskSourceIssue>;

  getId(): string {
    return this.taskSource.id;
  }

  getConfig(): Record<string, unknown> {
    return this.config;
  }
}
