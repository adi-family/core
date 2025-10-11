import type {ProcessorContext, ProjectProcessor} from './base';
import {GitlabProjectProcessor} from './gitlab';
import {JiraProjectProcessor} from './jira';
import {ParentProjectProcessor} from './parent';

export const createProjectProcessor = (context: ProcessorContext): ProjectProcessor => {
  switch (context.project.type) {
    case 'gitlab':
      return new GitlabProjectProcessor(context);
    case 'jira':
      return new JiraProjectProcessor(context);
    case 'parent':
      return new ParentProjectProcessor(context);
    default:
      throw new Error(`Unknown project type: ${context.project.type}`);
  }
};
