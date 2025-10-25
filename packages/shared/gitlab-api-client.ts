/**
 * GitLab API Client
 * Handles GitLab repository management, file operations, and pipeline triggers
 * Uses @gitbeaker/rest for API interactions
 */

import { Gitlab } from '@gitbeaker/rest'

export interface GitLabProjectCreateInput {
  name: string
  path: string
  namespace_id?: number
  visibility: 'private' | 'internal' | 'public'
  description?: string
}

export interface GitLabProject {
  id: number
  name: string
  path: string
  path_with_namespace: string
  web_url: string
  ssh_url_to_repo: string
  http_url_to_repo: string
}

export interface GitLabFileCreateInput {
  branch: string
  content: string
  commit_message: string
  encoding?: 'text' | 'base64'
}

export interface GitLabPipelineTriggerInput {
  ref: string
  variables: Record<string, string>
}

export interface GitLabPipeline {
  id: number
  iid: number
  project_id: number
  status: string
  ref: string
  sha: string
  web_url: string
  created_at: string
  updated_at: string
}

export interface GitLabFileContent {
  file_name: string
  file_path: string
  size: number
  encoding: string
  content: string
  content_sha256: string
  ref: string
  blob_id: string
  commit_id: string
  last_commit_id: string
}

export interface GitLabCommit {
  id: string
  short_id: string
  title: string
  author_name: string
  author_email: string
  authored_date: string
  committer_name: string
  committer_email: string
  committed_date: string
  message: string
}

export interface GitLabTreeEntry {
  id: string
  name: string
  type: 'tree' | 'blob'
  path: string
  mode: string
}

export interface GitLabSearchResult {
  basename: string
  data: string
  path: string
  filename: string
  id: number | null
  ref: string
  startline: number
  project_id: number
}

export interface GitLabPersonalAccessToken {
  id: number
  name: string
  revoked: boolean
  created_at: string
  scopes: string[]
  user_id: number
  last_used_at: string | null
  active: boolean
  expires_at: string | null
}

export interface GitLabFileAction {
  action: 'create' | 'delete' | 'move' | 'update' | 'chmod'
  filePath: string
  content?: string
  encoding?: 'text' | 'base64'
  previousPath?: string
  executeFilemode?: boolean
}

export interface GitLabBatchCommitInput {
  branch: string
  commitMessage: string
  actions: GitLabFileAction[]
  authorEmail?: string
  authorName?: string
}

export class GitLabApiClient {
  private client: InstanceType<typeof Gitlab>
  private host: string
  private token: string

  constructor(host: string, token: string) {
    this.host = host
    this.token = token
    this.client = new Gitlab({
      host,
      token
    })
  }

  /**
   * Create a new GitLab project
   */
  async createProject(input: GitLabProjectCreateInput): Promise<GitLabProject> {
    const project = await this.client.Projects.create({
      name: input.name,
      path: input.path,
      namespaceId: input.namespace_id,
      visibility: input.visibility,
      description: input.description
    }) as unknown as GitLabProject

    return project
  }

  /**
   * Update GitLab project settings to allow external pipeline triggers to set variables
   * GitLab 17.1+ introduced pipeline variable restrictions. This sets the minimum role
   * required to override pipeline variables to 'developer' (or can be set to allow all).
   */
  async enableExternalPipelineVariables(projectId: string): Promise<void> {
    // Use the Projects.edit API with the ci_pipeline_variables_minimum_override_role setting
    // Possible values: 'owner', 'maintainer', 'developer', 'reporter', 'guest', 'no_one_allowed'
    // Setting to 'developer' allows developers and above to set pipeline variables
    // Note: gitbeaker types may not include this option, so we cast to any
    await this.client.Projects.edit(projectId, {
      ciPipelineVariablesMinimumOverrideRole: 'developer',
    } as any)
  }

  /**
   * Upload a file to a repository
   */
  async createFile(
    projectId: string,
    filePath: string,
    input: GitLabFileCreateInput
  ): Promise<void> {
    await this.client.RepositoryFiles.create(
      projectId,
      filePath,
      input.branch,
      input.content,
      input.commit_message,
      {
        encoding: input.encoding || 'text'
      }
    )
  }

  /**
   * Update an existing file in a repository
   */
  async updateFile(
    projectId: string,
    filePath: string,
    input: GitLabFileCreateInput
  ): Promise<void> {
    await this.client.RepositoryFiles.edit(
      projectId,
      filePath,
      input.branch,
      input.content,
      input.commit_message,
      {
        encoding: input.encoding || 'text'
      }
    )
  }

  /**
   * Create or update a file (convenience method)
   */
  async uploadFile(
    projectId: string,
    filePath: string,
    content: string,
    commitMessage: string,
    branch: string = 'main'
  ): Promise<void> {
    const input: GitLabFileCreateInput = {
      branch,
      content,
      commit_message: commitMessage,
      encoding: 'text',
    }

    try {
      await this.createFile(projectId, filePath, input)
    } catch (error) {
      // If file exists, update it
      if (error instanceof Error && error.message.includes('already exists')) {
        await this.updateFile(projectId, filePath, input)
      } else {
        throw error
      }
    }
  }

  /**
   * Trigger a pipeline
   */
  async triggerPipeline(
    projectId: string,
    input: GitLabPipelineTriggerInput
  ): Promise<GitLabPipeline> {
    const pipeline = await this.client.Pipelines.create(projectId, input.ref, {
      variables: Object.entries(input.variables).map(([key, value]) => ({
        key,
        value,
        variable_type: 'env_var' as const
      }))
    }) as unknown as GitLabPipeline

    return pipeline
  }

  /**
   * Get pipeline status
   */
  async getPipeline(
    projectId: string,
    pipelineId: string
  ): Promise<GitLabPipeline> {
    const pipeline = await this.client.Pipelines.show(projectId, Number(pipelineId)) as unknown as GitLabPipeline

    return pipeline
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<{ id: number; username: string; name: string; namespace_id: number }> {
    const user = await this.client.Users.showCurrentUser() as unknown as {
      id: number
      username: string
      name: string
      namespace_id: number
    }
    return user
  }

  /**
   * Get current user's namespace ID
   */
  async getCurrentUserNamespaceId(): Promise<number> {
    const user = await this.getCurrentUser()
    return user.namespace_id
  }

  /**
   * Get personal access token information including scopes
   * This endpoint requires the token to have 'read_api' or 'api' scope
   */
  async getPersonalAccessTokenInfo(): Promise<GitLabPersonalAccessToken> {
    const response = await fetch(`${this.host}/api/v4/personal_access_tokens/self`, {
      headers: {
        'PRIVATE-TOKEN': this.token
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get token info: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data as GitLabPersonalAccessToken
  }

  /**
   * Find a project by its path (e.g., "username/project-name")
   */
  async findProjectByPath(path: string): Promise<GitLabProject | null> {
    try {
      const project = await this.client.Projects.show(path) as unknown as GitLabProject
      return project
    } catch (error) {
      // Project not found
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('Not Found'))) {
        return null
      }
      throw error
    }
  }

  /**
   * Read file content from repository at specific ref (commit/branch/tag)
   */
  async getFile(
    projectId: string,
    filePath: string,
    ref: string = 'main'
  ): Promise<GitLabFileContent> {
    const file = await this.client.RepositoryFiles.show(
      projectId,
      filePath,
      ref
    ) as unknown as GitLabFileContent

    // Decode content if base64 encoded
    if (file.encoding === 'base64') {
      file.content = Buffer.from(file.content, 'base64').toString('utf-8')
    }

    return file
  }

  /**
   * Get current commit SHA for a branch
   */
  async getCommitSha(
    projectId: string,
    branch: string = 'main'
  ): Promise<string> {
    const commits = await this.client.Commits.all(projectId, {
      refName: branch,
      perPage: 1
    }) as unknown as GitLabCommit[]

    if (commits.length === 0) {
      throw new Error(`No commits found for branch: ${branch}`)
    }

    const firstCommit = commits[0]
    if (!firstCommit) {
      throw new Error(`No commits found for branch: ${branch}`)
    }

    return firstCommit.id
  }

  /**
   * Search code in repository
   * Note: GitLab search API requires specific scope configuration
   */
  async searchCode(
    _projectId: string,
    _query: string,
    _ref?: string
  ): Promise<GitLabSearchResult[]> {
    // TODO: Implement code search when evaluation pipeline needs it
    // The Search API in gitbeaker has limited typing support
    console.warn('searchCode not yet implemented')
    return []
  }

  /**
   * List directory contents (tree)
   * Note: Tree API method signature varies by GitLab version
   */
  async getTree(
    _projectId: string,
    _path: string = '',
    _ref: string = 'main'
  ): Promise<GitLabTreeEntry[]> {
    // TODO: Implement tree listing when evaluation pipeline needs it
    // The tree method signature varies across gitbeaker versions
    console.warn('getTree not yet implemented')
    return []
  }

  /**
   * Get file raw content (convenience method)
   */
  async getFileContent(
    projectId: string,
    filePath: string,
    ref: string = 'main'
  ): Promise<string> {
    const file = await this.getFile(projectId, filePath, ref)
    return file.content
  }

  /**
   * Create a batch commit with multiple file actions (create/update/delete)
   * This allows uploading multiple files in a single commit, reducing commit clutter
   */
  async batchCommit(
    projectId: string,
    input: GitLabBatchCommitInput
  ): Promise<GitLabCommit> {
    const commit = await this.client.Commits.create(projectId, input.branch, input.commitMessage, input.actions, {
      authorEmail: input.authorEmail,
      authorName: input.authorName,
    }) as unknown as GitLabCommit

    return commit
  }

  /**
   * Upload multiple files in a single commit
   * Automatically detects if files need to be created or updated
   */
  async uploadFiles(
    projectId: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string,
    branch: string = 'main'
  ): Promise<GitLabCommit> {
    // Prepare file actions - try to determine if file exists
    const actions: GitLabFileAction[] = await Promise.all(
      files.map(async (file) => {
        try {
          // Check if file exists
          await this.getFile(projectId, file.path, branch)
          // File exists, update it
          return {
            action: 'update' as const,
            filePath: file.path,
            content: file.content,
            encoding: 'text' as const,
          }
        } catch {
          // File doesn't exist, create it
          return {
            action: 'create' as const,
            filePath: file.path,
            content: file.content,
            encoding: 'text' as const,
          }
        }
      })
    )

    return this.batchCommit(projectId, {
      branch,
      commitMessage: commitMessage,
      actions,
    })
  }
}
