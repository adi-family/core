import {BaseFileSpace, type FileSpace} from './base';
import {GitlabFileSpace} from './gitlab';
import {GithubFileSpace} from './github';
import {assertNever} from '@utils/assert-never';

export function createFileSpace(fileSpace: FileSpace): BaseFileSpace {
  switch (fileSpace.type) {
    case 'gitlab':
      return new GitlabFileSpace(fileSpace);
    case 'github':
      return new GithubFileSpace(fileSpace);
    default:
      assertNever(fileSpace.type);
      throw new Error('Unreachable');
  }
}
