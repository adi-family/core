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
  status?: string
  [key: string]: unknown
}

export interface FileSpace {
  id: string
  name: string
  type: 'gitlab' | 'github'
  enabled: boolean
  config: {
    repo: string
    host?: string
    access_token_secret_id?: string
  }
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
    return this.fetch<Session>(`/api/sessions/${sessionId}`)
  }

  async getTask(taskId: string): Promise<Task> {
    return this.fetch<Task>(`/api/tasks/${taskId}`)
  }

  async getFileSpace(fileSpaceId: string): Promise<FileSpace> {
    return this.fetch<FileSpace>(`/api/file-spaces/${fileSpaceId}`)
  }

  async getFileSpacesByProject(projectId: string): Promise<FileSpace[]> {
    return this.fetch<FileSpace[]>(`/api/file-spaces?project_id=${projectId}`)
  }

  async getFileSpacesByTask(taskId: string): Promise<FileSpace[]> {
    return this.fetch<FileSpace[]>(`/api/tasks/${taskId}/file-spaces`)
  }

  async getSecretValue(secretId: string): Promise<string> {
    const result = await this.fetch<{ value: string }>(`/api/secrets/${secretId}/value`)
    return result.value
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
    await this.fetch<Task>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    })
  }

  async updateTaskEvaluationStatus(taskId: string, evaluationStatus: string): Promise<void> {
    await this.fetch<void>(`/api/tasks/${taskId}/evaluation-status`, {
      method: 'POST',
      body: JSON.stringify({ status: evaluationStatus })
    })
  }

  async updateTaskEvaluationResult(taskId: string, result: 'ready' | 'needs_clarification'): Promise<void> {
    await this.fetch<void>(`/api/tasks/${taskId}/evaluation-result`, {
      method: 'PATCH',
      body: JSON.stringify({ result })
    })
  }

  async updateTaskEvaluationSimple(taskId: string, simpleResult: unknown): Promise<void> {
    await this.fetch<void>(`/api/tasks/${taskId}/evaluation-simple`, {
      method: 'PATCH',
      body: JSON.stringify({ simpleResult })
    })
  }

  async updateTaskEvaluationAgentic(taskId: string, agenticResult: unknown): Promise<void> {
    await this.fetch<void>(`/api/tasks/${taskId}/evaluation-agentic`, {
      method: 'PATCH',
      body: JSON.stringify({ agenticResult })
    })
  }

  async updateTaskImplementationStatus(taskId: string, status: 'pending' | 'queued' | 'implementing' | 'completed' | 'failed'): Promise<void> {
    await this.fetch<void>(`/api/tasks/${taskId}/implementation-status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    })
  }

  async saveApiUsage(
    executionId: string,
    sessionId: string,
    taskId: string,
    usage: {
      provider: string
      model: string
      goal: string
      phase: string
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
      ci_duration_seconds: number
      iteration_number?: number
      metadata?: unknown
    }
  ): Promise<void> {
    await this.fetch<void>(`/pipeline-executions/${executionId}/usage`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        task_id: taskId,
        ...usage
      })
    })
  }
}
