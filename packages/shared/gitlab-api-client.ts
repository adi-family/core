/**
 * GitLab API Client
 * Handles GitLab repository management, file operations, and pipeline triggers
 * Uses native fetch API for API interactions (no external dependencies)
 */

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

export interface GitLabMergeRequest {
  id: number
  iid: number
  project_id: number
  title: string
  description: string
  state: string
  web_url: string
  source_branch: string
  target_branch: string
  author: {
    id: number
    username: string
    name: string
  }
}

export interface GitLabMergeRequestCreateInput {
  source_branch: string
  target_branch: string
  title: string
  description?: string
  remove_source_branch?: boolean
}

export class GitLabApiClient {
  private host: string
  private token: string
  private tokenType: 'oauth' | 'pat'
  private defaultTimeout: number

  constructor(host: string, token: string, tokenType: 'oauth' | 'pat' = 'pat', defaultTimeout = 30000) {
    this.host = host.replace(/\/$/, '')
    this.token = token
    this.tokenType = tokenType
    this.defaultTimeout = defaultTimeout
  }

  /**
   * Make a GitLab API request with configurable timeout
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
    timeoutMs?: number
  ): Promise<T> {
    const url = `${this.host}/api/v4${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Use appropriate authentication header based on token type
    if (this.tokenType === 'oauth') {
      headers['Authorization'] = `Bearer ${this.token}`
    } else {
      headers['PRIVATE-TOKEN'] = this.token
    }

    const timeout = timeoutMs ?? this.defaultTimeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const options: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `GitLab API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      return response.json() as Promise<T>
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`GitLab API request timeout after ${timeout}ms`)
      }
      throw error
    }
  }

  /**
   * Create a new GitLab project
   */
  async createProject(input: GitLabProjectCreateInput): Promise<GitLabProject> {
    return this.request<GitLabProject>('POST', '/projects', {
      name: input.name,
      path: input.path,
      namespace_id: input.namespace_id,
      visibility: input.visibility,
      description: input.description,
    })
  }

  /**
   * Update GitLab project settings to allow external pipeline triggers to set variables
   */
  async enableExternalPipelineVariables(projectId: string): Promise<void> {
    await this.request('PUT', `/projects/${encodeURIComponent(projectId)}`, {
      ci_pipeline_variables_minimum_override_role: 'developer',
    })
  }

  /**
   * Enable CI/CD pipelines for a project
   */
  async enableCICD(projectId: string): Promise<void> {
    await this.request('PUT', `/projects/${encodeURIComponent(projectId)}`, {
      builds_access_level: 'enabled',
      jobs_enabled: true,
    })
  }

  /**
   * Get project details by ID
   */
  async getProject(projectId: string): Promise<GitLabProject> {
    return this.request<GitLabProject>(
      'GET',
      `/projects/${encodeURIComponent(projectId)}`
    )
  }

  /**
   * Upload a file to a repository
   * @param timeoutMs - Optional timeout in milliseconds (default: auto-calculated based on content size)
   */
  async createFile(
    projectId: string,
    filePath: string,
    input: GitLabFileCreateInput,
    timeoutMs?: number
  ): Promise<void> {
    // Auto-calculate timeout based on content size for large files
    const contentSize = input.content.length
    const contentSizeMB = contentSize / (1024 * 1024)
    // 2 minutes base + 1 minute per 10MB (minimum 2 minutes, maximum 15 minutes)
    const autoTimeout = Math.min(Math.max(120000 + (contentSizeMB / 10) * 60000, 120000), 900000)
    const timeout = timeoutMs ?? autoTimeout

    await this.request(
      'POST',
      `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}`,
      {
        branch: input.branch,
        content: input.content,
        commit_message: input.commit_message,
        encoding: input.encoding || 'text',
      },
      timeout
    )
  }

  /**
   * Update an existing file in a repository
   * @param timeoutMs - Optional timeout in milliseconds (default: auto-calculated based on content size)
   */
  async updateFile(
    projectId: string,
    filePath: string,
    input: GitLabFileCreateInput,
    timeoutMs?: number
  ): Promise<void> {
    // Auto-calculate timeout based on content size for large files
    const contentSize = input.content.length
    const contentSizeMB = contentSize / (1024 * 1024)
    // 2 minutes base + 1 minute per 10MB (minimum 2 minutes, maximum 15 minutes)
    const autoTimeout = Math.min(Math.max(120000 + (contentSizeMB / 10) * 60000, 120000), 900000)
    const timeout = timeoutMs ?? autoTimeout

    await this.request(
      'PUT',
      `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}`,
      {
        branch: input.branch,
        content: input.content,
        commit_message: input.commit_message,
        encoding: input.encoding || 'text',
      },
      timeout
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
    branch = 'main'
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
    return this.request<GitLabPipeline>(
      'POST',
      `/projects/${encodeURIComponent(projectId)}/pipeline`,
      {
        ref: input.ref,
        variables: Object.entries(input.variables).map(([key, value]) => ({
          key,
          value,
          variable_type: 'env_var',
        })),
      }
    )
  }

  /**
   * Get pipeline status
   */
  async getPipeline(
    projectId: string,
    pipelineId: string
  ): Promise<GitLabPipeline> {
    return this.request<GitLabPipeline>(
      'GET',
      `/projects/${encodeURIComponent(projectId)}/pipelines/${pipelineId}`
    )
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<{
    id: number
    username: string
    name: string
    namespace_id: number
  }> {
    return this.request<{
      id: number
      username: string
      name: string
      namespace_id: number
    }>('GET', '/user')
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
   */
  async getPersonalAccessTokenInfo(): Promise<GitLabPersonalAccessToken> {
    return this.request<GitLabPersonalAccessToken>(
      'GET',
      '/personal_access_tokens/self'
    )
  }

  /**
   * Find a project by its path (e.g., "username/project-name")
   */
  async findProjectByPath(path: string): Promise<GitLabProject | null> {
    try {
      return await this.request<GitLabProject>(
        'GET',
        `/projects/${encodeURIComponent(path)}`
      )
    } catch (error) {
      // Project not found
      if (
        error instanceof Error &&
        (error.message.includes('404') || error.message.includes('Not Found'))
      ) {
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
    ref = 'main'
  ): Promise<GitLabFileContent> {
    const file = await this.request<GitLabFileContent>(
      'GET',
      `/projects/${encodeURIComponent(projectId)}/repository/files/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`
    )

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
    branch = 'main'
  ): Promise<string> {
    const commits = await this.request<GitLabCommit[]>(
      'GET',
      `/projects/${encodeURIComponent(projectId)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=1`
    )

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
   */
  async searchCode(
    _projectId: string,
    _query: string,
    _ref?: string
  ): Promise<GitLabSearchResult[]> {
    // TODO: Implement code search when evaluation pipeline needs it
    console.warn('searchCode not yet implemented')
    return []
  }

  /**
   * List directory contents (tree)
   */
  async getTree(
    _projectId: string,
    _path = '',
    _ref = 'main'
  ): Promise<GitLabTreeEntry[]> {
    // TODO: Implement tree listing when evaluation pipeline needs it
    console.warn('getTree not yet implemented')
    return []
  }

  /**
   * Get file raw content (convenience method)
   */
  async getFileContent(
    projectId: string,
    filePath: string,
    ref = 'main'
  ): Promise<string> {
    const file = await this.getFile(projectId, filePath, ref)
    return file.content
  }

  /**
   * Create a batch commit with multiple file actions (create/update/delete)
   * @param timeoutMs - Optional timeout in milliseconds (default: 5 minutes for large uploads)
   */
  async batchCommit(
    projectId: string,
    input: GitLabBatchCommitInput,
    timeoutMs?: number
  ): Promise<GitLabCommit> {
    // Default to 5 minutes for batch commits (large file uploads)
    const timeout = timeoutMs ?? 300000
    return this.request<GitLabCommit>(
      'POST',
      `/projects/${encodeURIComponent(projectId)}/repository/commits`,
      {
        branch: input.branch,
        commit_message: input.commitMessage,
        actions: input.actions.map((action) => ({
          action: action.action,
          file_path: action.filePath,
          content: action.content,
          encoding: action.encoding,
          previous_path: action.previousPath,
          execute_filemode: action.executeFilemode,
        })),
        author_email: input.authorEmail,
        author_name: input.authorName,
      },
      timeout
    )
  }

  /**
   * Upload multiple files in a single commit
   * @param timeoutMs - Optional timeout in milliseconds (default: auto-calculated based on file sizes)
   */
  async uploadFiles(
    projectId: string,
    files: { path: string; content: string; encoding?: 'text' | 'base64' }[],
    commitMessage: string,
    branch = 'main',
    timeoutMs?: number
  ): Promise<GitLabCommit> {
    // Calculate total size for timeout estimation
    const totalSize = files.reduce((sum, file) => sum + file.content.length, 0)
    const totalSizeMB = totalSize / (1024 * 1024)

    // Auto-calculate timeout: 5 minutes base + 1 minute per MB (minimum 5 minutes, maximum 15 minutes)
    const autoTimeout = Math.min(Math.max(300000 + (totalSizeMB * 60000), 300000), 900000)
    const timeout = timeoutMs ?? autoTimeout

    // Prepare file actions - try to determine if file exists
    const actions: GitLabFileAction[] = await Promise.all(
      files.map(async (file) => {
        const encoding = file.encoding || 'text'
        try {
          // Check if file exists
          await this.getFile(projectId, file.path, branch)
          // File exists, update it
          return {
            action: 'update' as const,
            filePath: file.path,
            content: file.content,
            encoding,
          }
        } catch {
          // File doesn't exist, create it
          return {
            action: 'create' as const,
            filePath: file.path,
            content: file.content,
            encoding,
          }
        }
      })
    )

    return this.batchCommit(projectId, {
      branch,
      commitMessage: commitMessage,
      actions,
    }, timeout)
  }

  /**
   * Create a merge request
   */
  async createMergeRequest(
    projectId: string,
    input: GitLabMergeRequestCreateInput
  ): Promise<GitLabMergeRequest> {
    return this.request<GitLabMergeRequest>(
      'POST',
      `/projects/${encodeURIComponent(projectId)}/merge_requests`,
      {
        source_branch: input.source_branch,
        target_branch: input.target_branch,
        title: input.title,
        description: input.description,
        remove_source_branch: input.remove_source_branch,
      }
    )
  }

  /**
   * Legacy client property for backward compatibility with code accessing client.MergeRequests
   */
  get client() {
    return {
      MergeRequests: {
        create: async (
          projectId: string,
          sourceBranch: string,
          targetBranch: string,
          title: string,
          options?: {
            description?: string
            removeSourceBranch?: boolean
          }
        ) => {
          return this.createMergeRequest(projectId, {
            source_branch: sourceBranch,
            target_branch: targetBranch,
            title,
            description: options?.description,
            remove_source_branch: options?.removeSourceBranch,
          })
        },
      },
      Projects: {
        create: async (input: any) => this.createProject(input),
        edit: async (projectId: string, options: any) =>
          this.request('PUT', `/projects/${encodeURIComponent(projectId)}`, options),
        show: async (path: string) => this.findProjectByPath(path),
      },
      RepositoryFiles: {
        create: async (
          projectId: string,
          filePath: string,
          branch: string,
          content: string,
          commitMessage: string,
          options?: any
        ) =>
          this.createFile(projectId, filePath, {
            branch,
            content,
            commit_message: commitMessage,
            encoding: options?.encoding,
          }),
        edit: async (
          projectId: string,
          filePath: string,
          branch: string,
          content: string,
          commitMessage: string,
          options?: any
        ) =>
          this.updateFile(projectId, filePath, {
            branch,
            content,
            commit_message: commitMessage,
            encoding: options?.encoding,
          }),
        show: async (projectId: string, filePath: string, ref: string) =>
          this.getFile(projectId, filePath, ref),
      },
      Pipelines: {
        create: async (projectId: string, ref: string, _options: any) =>
          this.triggerPipeline(projectId, { ref, variables: {} }),
        show: async (projectId: string, pipelineId: number) =>
          this.getPipeline(projectId, String(pipelineId)),
      },
      Users: {
        showCurrentUser: async () => this.getCurrentUser(),
      },
      Commits: {
        all: async (projectId: string, options: any) =>
          this.request<GitLabCommit[]>(
            'GET',
            `/projects/${encodeURIComponent(projectId)}/repository/commits?ref_name=${encodeURIComponent(options.refName)}&per_page=${options.perPage}`
          ),
        create: async (
          projectId: string,
          branch: string,
          commitMessage: string,
          actions: any[],
          options?: any
        ) =>
          this.batchCommit(projectId, {
            branch,
            commitMessage,
            actions,
            authorEmail: options?.authorEmail,
            authorName: options?.authorName,
          }, options?.timeoutMs),
      },
    }
  }
}
