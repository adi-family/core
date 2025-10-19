/**
 * GitLab API Client
 * Handles GitLab repository management, file operations, and pipeline triggers
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

export class GitLabApiClient {
  private baseUrl: string
  private token: string

  constructor(host: string, token: string) {
    this.baseUrl = host.replace(/\/$/, '') // Remove trailing slash
    this.token = token
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v4${path}`
    const headers: Record<string, string> = {
      'PRIVATE-TOKEN': this.token,
      'Content-Type': 'application/json',
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `GitLab API request failed: ${response.status} ${response.statusText}\n${errorText}`
      )
    }

    return await response.json() as Promise<T>
  }

  /**
   * Create a new GitLab project
   */
  async createProject(input: GitLabProjectCreateInput): Promise<GitLabProject> {
    return this.request<GitLabProject>('POST', '/projects', input)
  }

  /**
   * Upload a file to a repository
   */
  async createFile(
    projectId: string,
    filePath: string,
    input: GitLabFileCreateInput
  ): Promise<void> {
    const encodedProjectId = encodeURIComponent(projectId)
    const encodedFilePath = encodeURIComponent(filePath)
    await this.request(
      'POST',
      `/projects/${encodedProjectId}/repository/files/${encodedFilePath}`,
      input
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
    const encodedProjectId = encodeURIComponent(projectId)
    const encodedFilePath = encodeURIComponent(filePath)
    await this.request(
      'PUT',
      `/projects/${encodedProjectId}/repository/files/${encodedFilePath}`,
      input
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
    const encodedProjectId = encodeURIComponent(projectId)
    return this.request<GitLabPipeline>(
      'POST',
      `/projects/${encodedProjectId}/pipeline`,
      input
    )
  }

  /**
   * Get pipeline status
   */
  async getPipeline(
    projectId: string,
    pipelineId: string
  ): Promise<GitLabPipeline> {
    const encodedProjectId = encodeURIComponent(projectId)
    return this.request<GitLabPipeline>(
      'GET',
      `/projects/${encodedProjectId}/pipelines/${pipelineId}`
    )
  }

  /**
   * Get current user's namespace ID
   */
  async getCurrentUserNamespaceId(): Promise<number> {
    const user = await this.request<{ id: number; namespace_id: number }>(
      'GET',
      '/user'
    )
    return user.namespace_id
  }
}
