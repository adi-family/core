import {BaseFileSpace, type FileSpace, type WorkspaceLocation} from './base';
import * as fs from 'fs';
import {exec} from 'child_process';
import {promisify} from 'util';
import {createLogger} from '@utils/logger.ts';

const execAsync = promisify(exec);

export class GitlabFileSpace extends BaseFileSpace {
  private logger = createLogger({ namespace: 'GitlabFileSpace' });

  constructor(fileSpace: FileSpace) {
    super(fileSpace);
  }

  async clone(workDir: string): Promise<string> {
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, {recursive: true});
      this.logger.warn(`Cloning GitLab repository ${this.config.repo} into ${workDir}...`);
      await execAsync(`glab repo clone ${this.config.repo} ${workDir}`);
    }
    return workDir;
  }

  async workspaceExists(location: WorkspaceLocation): Promise<boolean> {
    try {
      const {stdout} = await execAsync(
        `git -C ${location.workDir} rev-parse --verify ${location.workspaceName}`,
        {encoding: 'utf-8'}
      );
      return stdout.trim() !== '';
    } catch {
      return false;
    }
  }

  async switchToWorkspace(location: WorkspaceLocation): Promise<void> {
    this.logger.success(`Checking out branch ${location.workspaceName}...`);
    await execAsync(`git -C ${location.workDir} checkout ${location.workspaceName}`);
  }

  async createWorkspace(location: WorkspaceLocation): Promise<void> {
    this.logger.success(`Creating and checking out new branch ${location.workspaceName}...`);
    await execAsync(`git -C ${location.workDir} checkout -b ${location.workspaceName}`);
  }
}
