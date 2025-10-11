import type {Sql} from 'postgres';
import type {Project} from '../queries';

export type Issue = {
  id: () => string;
  iid?: () => number | null;
  title: () => string;
  updatedAt: () => Date;
  uniqueId: () => string;
};

export type ProcessorContext = {
  sql: Sql;
  project: Project;
  telegramConfig: {
    botToken: string;
    chatId: string;
    threadId?: string;
  };
  workerId: string;
  selectRunner: () => string;
  appsDir: string;
};

export type ProjectProcessor = {
  getIssues: () => AsyncIterable<Issue>;
  processIssue: (issue: Issue) => Promise<void>;
  setupWorkspace: (issue: Issue) => string;
};

export abstract class BaseProjectProcessor implements ProjectProcessor {
  protected context: ProcessorContext;

  constructor(context: ProcessorContext) {
    this.context = context;
  }

  abstract getIssues(): AsyncIterable<Issue>;
  abstract processIssue(issue: Issue): Promise<void>;
  abstract setupWorkspace(issue: Issue): string;
}
