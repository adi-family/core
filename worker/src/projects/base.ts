import type {Sql} from 'postgres';
import type {Project} from '../queries';
import type {BaseFileSpace} from '../file-spaces/base';
import type {BaseTaskSource, TaskSourceIssue} from '../task-sources/base';
import type {RunnerType} from '../runners';

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
  selectRunner: () => RunnerType;
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
    // Design by Contract: Validate preconditions
    if (!context.sql) {
      throw new Error('ProcessorContext requires sql connection');
    }
    if (!context.project) {
      throw new Error('ProcessorContext requires project');
    }
    if (!Array.isArray(context.fileSpaces)) {
      throw new Error('ProcessorContext requires fileSpaces array');
    }
    if (!context.taskSource) {
      throw new Error('ProcessorContext requires taskSource');
    }
    if (!context.telegramConfig) {
      throw new Error('ProcessorContext requires telegramConfig');
    }
    if (!context.telegramConfig.botToken || context.telegramConfig.botToken.trim() === '') {
      throw new Error('ProcessorContext requires non-empty telegramConfig.botToken');
    }
    if (!context.telegramConfig.chatId || context.telegramConfig.chatId.trim() === '') {
      throw new Error('ProcessorContext requires non-empty telegramConfig.chatId');
    }
    if (!context.workerId || context.workerId.trim() === '') {
      throw new Error('ProcessorContext requires non-empty workerId');
    }
    if (typeof context.selectRunner !== 'function') {
      throw new Error('ProcessorContext requires selectRunner to be a function');
    }
    if (!context.appsDir || context.appsDir.trim() === '') {
      throw new Error('ProcessorContext requires non-empty appsDir');
    }

    this.context = context;
    this.fileSpaces = context.fileSpaces;
    this.taskSource = context.taskSource;
  }

  abstract processIssues(): Promise<void>;
  abstract processIssue(issue: TaskSourceIssue, fileSpace: BaseFileSpace): Promise<void>;
}

export function selectFileSpace(context: ProcessorContext): BaseFileSpace {
  // Design by Contract: Validate precondition with contextual error
  const fileSpace = context.fileSpaces[0];
  if (!fileSpace) {
    throw new Error(
      `No file spaces available for project '${context.project.name}' (${context.project.id}). ` +
      'Ensure at least one enabled file space is configured for this project.'
    );
  }
  return fileSpace;
}
