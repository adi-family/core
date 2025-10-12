import type {ProcessorContext, ProjectProcessor} from './base';
import {GitlabProjectProcessor} from './gitlab';
import {JiraProjectProcessor} from './jira';
import {ParentProjectProcessor} from './parent';
import {assertNever} from '../../utils/assert-never';

export const createProjectProcessor = (context: ProcessorContext): ProjectProcessor => {
  switch (context.project.type) {
    case 'gitlab':
      return new GitlabProjectProcessor(context);
    case 'jira':
      return new JiraProjectProcessor(context);
    case 'parent':
      return new ParentProjectProcessor(context);
    default:
      assertNever(context.project);
      throw new Error('Unreachable');
  }
};
