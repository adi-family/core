import {BaseFileSpace, type FileSpace, type WorkspaceLocation} from './base';
import * as fs from 'fs';
import {execSync} from 'child_process';
import {createLogger} from '../../utils/logger';

export class GithubFileSpace extends BaseFileSpace {
  private logger = createLogger({ namespace: 'GithubFileSpace' });

  constructor(fileSpace: FileSpace) {
    super(fileSpace);
  }

  async clone(workDir: string): Promise<string> {
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, {recursive: true});
      this.logger.warn(`Cloning GitHub repository ${this.config.repo} into ${workDir}...`);
      execSync(`gh repo clone ${this.config.repo} ${workDir}`, {stdio: 'inherit'});
    }
    return workDir;
  }

  async workspaceExists(location: WorkspaceLocation): Promise<boolean> {
    const result = execSync(
      `git -C ${location.workDir} rev-parse --verify ${location.workspaceName} 2>/dev/null || echo ""`,
      {encoding: 'utf-8'}
    ).trim();
    return result !== '';
  }

  async switchToWorkspace(location: WorkspaceLocation): Promise<void> {
    this.logger.success(`Checking out branch ${location.workspaceName}...`);
    execSync(`git -C ${location.workDir} checkout ${location.workspaceName}`, {stdio: 'inherit'});
  }

  async createWorkspace(location: WorkspaceLocation): Promise<void> {
    this.logger.success(`Creating and checking out new branch ${location.workspaceName}...`);
    execSync(`git -C ${location.workDir} checkout -b ${location.workspaceName}`, {stdio: 'inherit'});
  }
}
