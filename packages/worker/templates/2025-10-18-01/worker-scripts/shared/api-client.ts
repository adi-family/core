/**
 * API Client for communicating with our backend
 * Standalone fetch-based client for use in GitLab CI workers
 */

// Minimal type definitions
export interface Session {
  id: string
  task_id: string | null
  runner: string | null
  [key: string]: unknown
}

export interface Task {
  id: string
  title: string
  description: string | null
  project_id: string | null
  file_space_id: string | null
  status?: string
  [key: string]: unknown
}

export interface FileSpace {
  id: string
  [key: string]: unknown
}

// API Client using fetch
export class ApiClient {
  private baseUrl: string
  private token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl
    this.token = token
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`)
    }

    return await response.json() as T
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.fetch<Session>(`/sessions/${sessionId}`)
  }

  async getTask(taskId: string): Promise<Task> {
    return this.fetch<Task>(`/tasks/${taskId}`)
  }

  async getFileSpace(fileSpaceId: string): Promise<FileSpace> {
    return this.fetch<FileSpace>(`/file-spaces/${fileSpaceId}`)
  }

  async createPipelineArtifact(
    executionId: string,
    data: {
      artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit' | 'execution_result' | 'text'
      reference_url: string
      metadata?: unknown
    }
  ): Promise<void> {
    await this.fetch<void>(`/pipeline-executions/${executionId}/artifacts`, {
      method: 'POST',
      body: JSON.stringify({
        pipeline_execution_id: executionId,
        ...data
      })
    })
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    await this.fetch<Task>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  }

  async updateTaskEvaluationStatus(taskId: string, evaluationStatus: string, evaluationSessionId?: string): Promise<void> {
    const body: Record<string, string> = { evaluation_status: evaluationStatus }
    if (evaluationSessionId) {
      body.evaluation_session_id = evaluationSessionId
    }
    await this.fetch<Task>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    })
  }
}
