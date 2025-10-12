import {BaseFileSpace, type FileSpace} from './base';
import {GitlabFileSpace} from './gitlab';
import {GithubFileSpace} from './github';

export function createFileSpace(fileSpace: FileSpace): BaseFileSpace {
  switch (fileSpace.type) {
    case 'gitlab':
      return new GitlabFileSpace(fileSpace);
    case 'github':
      return new GithubFileSpace(fileSpace);
    default:
      throw new Error(`Unknown file space type: ${fileSpace.type}`);
  }
}
