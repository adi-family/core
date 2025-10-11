import {BaseFileSpace, type FileSpace} from './base';
import * as fs from 'fs';
import {execSync} from 'child_process';
import chalk from 'chalk';

export class GitlabFileSpace extends BaseFileSpace {
  constructor(fileSpace: FileSpace) {
    super(fileSpace);
  }

  async clone(workDir: string): Promise<string> {
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, {recursive: true});
      console.log(chalk.yellow(`Cloning GitLab repository ${this.config.repo} into ${workDir}...`));
      execSync(`glab repo clone ${this.config.repo} ${workDir}`, {stdio: 'inherit'});
    }
    return workDir;
  }

  async workspaceExists(workDir: string, workspaceName: string): Promise<boolean> {
    const result = execSync(
      `git -C ${workDir} rev-parse --verify ${workspaceName} 2>/dev/null || echo ""`,
      {encoding: 'utf-8'}
    ).trim();
    return result !== '';
  }

  async switchToWorkspace(workDir: string, workspaceName: string): Promise<void> {
    console.log(chalk.green(`Checking out branch ${workspaceName}...`));
    execSync(`git -C ${workDir} checkout ${workspaceName}`, {stdio: 'inherit'});
  }

  async createWorkspace(workDir: string, workspaceName: string): Promise<void> {
    console.log(chalk.green(`Creating and checking out new branch ${workspaceName}...`));
    execSync(`git -C ${workDir} checkout -b ${workspaceName}`, {stdio: 'inherit'});
  }
}
