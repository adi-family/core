/**
 * API Client for communicating with our backend
 * Handles authentication and common API operations
 */

export interface Session {
  id: string
  task_id: string | null
  runner: string
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: string
  project_id: string | null
  task_source_id: string
  file_space_id: string | null
  source_gitlab_issue: unknown | null
  source_github_issue: unknown | null
  source_jira_issue: unknown | null
  created_at: string
  updated_at: string
}

export interface FileSpace {
  id: string
  project_id: string
  name: string
  type: 'gitlab' | 'github'
  config: unknown
  enabled: boolean
  created_at: string
  updated_at: string
}

export class ApiClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.token = token
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
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
        `API request failed: ${response.status} ${response.statusText}\n${errorText}`
      )
    }

    return await response.json() as Promise<T>
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>('GET', `/sessions/${sessionId}`)
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>('GET', `/tasks/${taskId}`)
  }

  async getFileSpace(fileSpaceId: string): Promise<FileSpace> {
    return this.request<FileSpace>('GET', `/file-spaces/${fileSpaceId}`)
  }

  async createPipelineArtifact(
    executionId: string,
    data: {
      artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit'
      reference_url: string
      metadata?: unknown
    }
  ): Promise<void> {
    await this.request(
      'POST',
      `/pipeline-executions/${executionId}/artifacts`,
      data
    )
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    await this.request('PATCH', `/tasks/${taskId}`, { status })
  }
}
