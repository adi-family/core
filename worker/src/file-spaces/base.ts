export type FileSpaceConfig = {
  repo: string;
  host?: string;
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
    this.fileSpace = fileSpace;
    this.config = fileSpace.config;
  }

  abstract clone(workDir: string): Promise<string>;
  abstract createWorkspace(workDir: string, workspaceName: string): Promise<void>;
  abstract switchToWorkspace(workDir: string, workspaceName: string): Promise<void>;
  abstract workspaceExists(workDir: string, workspaceName: string): Promise<boolean>;

  getConfig(): FileSpaceConfig {
    return this.config;
  }

  getId(): string {
    return this.fileSpace.id;
  }
}
