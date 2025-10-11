import {BaseProjectProcessor, type Issue, type ProcessorContext} from './base';
import {getProjectById} from '../queries';
import {createProjectProcessor} from './factory';
import chalk from 'chalk';

export type ParentConfig = {
  child_project_ids: string[];
};

export class ParentProjectProcessor extends BaseProjectProcessor {
  private config: ParentConfig;

  constructor(context: ProcessorContext) {
    super(context);
    this.config = context.project.config as ParentConfig;
  }

  async *getIssues(): AsyncIterable<Issue> {
    for (const childProjectId of this.config.child_project_ids) {
      const childProject = await getProjectById(this.context.sql, childProjectId);

      if (!childProject) {
        console.warn(chalk.yellow(`[Parent/${this.context.project.name}] Child project ${childProjectId} not found`));
        continue;
      }

      if (!childProject.enabled) {
        console.log(chalk.gray(`[Parent/${this.context.project.name}] Child project ${childProject.name} is disabled, skipping`));
        continue;
      }

      console.log(chalk.magenta(`[Parent/${this.context.project.name}] Processing child project: ${childProject.name}`));

      const childContext: ProcessorContext = {
        ...this.context,
        project: childProject
      };

      const processor = createProjectProcessor(childContext);

      for await (const issue of processor.getIssues()) {
        yield issue;
      }
    }
  }

  async processIssue(_issue: Issue): Promise<void> {
    throw new Error('ParentProjectProcessor.processIssue should not be called directly. Issues should be processed by child processors.');
  }

  setupWorkspace(_issue: Issue): string {
    throw new Error('ParentProjectProcessor.setupWorkspace should not be called directly. Workspace should be set up by child processors.');
  }
}
