import type {Sql} from 'postgres';
import type {Project} from '../queries';
import type {BaseFileSpace} from '../file-spaces/base';
import type {BaseTaskSource, TaskSourceIssue} from '../task-sources/base';

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
  fileSpaces: BaseFileSpace[];
  taskSource: BaseTaskSource;
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
  processIssues: () => Promise<void>;
};

export abstract class BaseProjectProcessor implements ProjectProcessor {
  protected context: ProcessorContext;
  protected fileSpaces: BaseFileSpace[];
  protected taskSource: BaseTaskSource;

  constructor(context: ProcessorContext) {
    this.context = context;
    this.fileSpaces = context.fileSpaces;
    this.taskSource = context.taskSource;
  }

  abstract processIssues(): Promise<void>;
  abstract processIssue(issue: TaskSourceIssue, fileSpace: BaseFileSpace): Promise<void>;

  protected selectFileSpace(): BaseFileSpace {
    if (this.fileSpaces.length === 0) {
      throw new Error('No file spaces available for this project');
    }
    return this.fileSpaces[0];
  }
}
