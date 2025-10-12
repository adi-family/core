export type FileSpaceConfig = {
  repo: string;
  host?: string;
};

export type WorkspaceLocation = {
  workDir: string;
  workspaceName: string;
};

export type FileSpace = {
  id: string;
  project_id: string;
  name: string;
  type: string;
  config: FileSpaceConfig;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export abstract class BaseFileSpace {
  protected config: FileSpaceConfig;
  protected fileSpace: FileSpace;

  constructor(fileSpace: FileSpace) {
    // Design by Contract: Validate preconditions
    if (!fileSpace.config.repo || fileSpace.config.repo.trim() === '') {
      throw new Error('File space requires non-empty repo in config');
    }

    this.fileSpace = fileSpace;
    this.config = fileSpace.config;
  }

  abstract clone(workDir: string): Promise<string>;
  abstract createWorkspace(location: WorkspaceLocation): Promise<void>;
  abstract switchToWorkspace(location: WorkspaceLocation): Promise<void>;
  abstract workspaceExists(location: WorkspaceLocation): Promise<boolean>;

  getId(): string {
    return this.fileSpace.id;
  }
}
