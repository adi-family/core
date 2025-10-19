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

export class GitLabApiClient {
  private client: InstanceType<typeof Gitlab>

  constructor(host: string, token: string) {
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
   * Get current user's namespace ID
   */
  async getCurrentUserNamespaceId(): Promise<number> {
    // @ts-expect-error - current() exists but is not properly typed in @gitbeaker/rest
    const user = await this.client.Users.current() as unknown as { namespace_id: number }
    return user.namespace_id
  }
}
