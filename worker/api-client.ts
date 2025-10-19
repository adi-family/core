/**
 * Backend API Client for Worker
 * Provides typed HTTP client for all backend operations needed by worker
 */

import type {
  Project,
  Task,
  Session,
  WorkerRepository,
  PipelineExecution,
  CreatePipelineExecutionInput,
  UpdatePipelineExecutionInput,
  CreatePipelineArtifactInput,
  PipelineArtifact,
  Result
} from '../backend/types'
import type { LockContext, SignalInfo } from '../db/worker-cache'

export class BackendApiClient {
  private baseUrl: string
  private apiToken: string | undefined

  constructor(baseUrl: string, apiToken?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiToken = apiToken
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API request failed: ${response.status} ${error}`)
    }

    return response.json() as Promise<T>
  }

  // Projects
  async getProject(id: string): Promise<Result<Project>> {
    try {
      const project = await this.request<Project>(`/projects/${id}`)
      return { ok: true, data: project }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Tasks
  async getTask(id: string): Promise<Result<Task>> {
    try {
      const task = await this.request<Task>(`/tasks/${id}`)
      return { ok: true, data: task }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Result<Task>> {
    try {
      const task = await this.request<Task>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      return { ok: true, data: task }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Sessions
  async getSession(id: string): Promise<Result<Session>> {
    try {
      const session = await this.request<Session>(`/sessions/${id}`)
      return { ok: true, data: session }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getSessionsByTask(taskId: string): Promise<Session[]> {
    return this.request<Session[]>(`/tasks/${taskId}/sessions`)
  }

  // Worker Repositories
  async getWorkerRepositoryByProjectId(projectId: string): Promise<Result<WorkerRepository>> {
    try {
      const repo = await this.request<WorkerRepository>(`/projects/${projectId}/worker-repository`)
      return { ok: true, data: repo }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Pipeline Executions
  async createPipelineExecution(data: CreatePipelineExecutionInput): Promise<PipelineExecution> {
    return this.request<PipelineExecution>('/pipeline-executions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getPipelineExecution(id: string): Promise<Result<PipelineExecution>> {
    try {
      const execution = await this.request<PipelineExecution>(`/pipeline-executions/${id}`)
      return { ok: true, data: execution }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async updatePipelineExecution(id: string, data: UpdatePipelineExecutionInput): Promise<Result<PipelineExecution>> {
    try {
      const execution = await this.request<PipelineExecution>(`/pipeline-executions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      return { ok: true, data: execution }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getPipelineExecutionBySessionId(sessionId: string): Promise<Result<PipelineExecution>> {
    try {
      const execution = await this.request<PipelineExecution>(`/sessions/${sessionId}/pipeline-executions`)
      return { ok: true, data: execution }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getStalePipelineExecutions(timeoutMinutes: number): Promise<PipelineExecution[]> {
    return this.request<PipelineExecution[]>(`/pipeline-executions/stale?timeoutMinutes=${timeoutMinutes}`)
  }

  async getWorkerRepository(id: string): Promise<Result<WorkerRepository>> {
    try {
      const repo = await this.request<WorkerRepository>(`/worker-repositories/${id}`)
      return { ok: true, data: repo }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Pipeline Artifacts
  async createPipelineArtifact(executionId: string, data: Omit<CreatePipelineArtifactInput, 'pipeline_execution_id'>): Promise<PipelineArtifact> {
    return this.request<PipelineArtifact>(`/pipeline-executions/${executionId}/artifacts`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Worker Cache (Traffic Light)
  async isSignaledBefore(projectId: string, issueId: string, date: Date): Promise<boolean> {
    const result = await this.request<{ signaled: boolean }>(`/projects/${projectId}/worker-cache/is-signaled`, {
      method: 'POST',
      body: JSON.stringify({ issueId, date: date.toISOString() }),
    })
    return result.signaled
  }

  async tryAcquireLock(projectId: string, lockContext: LockContext): Promise<boolean> {
    const result = await this.request<{ acquired: boolean }>(`/projects/${projectId}/worker-cache/try-acquire-lock`, {
      method: 'POST',
      body: JSON.stringify(lockContext),
    })
    return result.acquired
  }

  async releaseLock(projectId: string, issueId: string): Promise<void> {
    await this.request<{ success: boolean }>(`/projects/${projectId}/worker-cache/release-lock`, {
      method: 'POST',
      body: JSON.stringify({ issueId }),
    })
  }

  async signal(projectId: string, signalInfo: SignalInfo): Promise<void> {
    await this.request<{ success: boolean }>(`/projects/${projectId}/worker-cache/signal`, {
      method: 'POST',
      body: JSON.stringify({
        ...signalInfo,
        date: signalInfo.date.toISOString()
      }),
    })
  }

  async getTaskId(projectId: string, issueId: string): Promise<string | null> {
    const result = await this.request<{ taskId: string | null }>(`/projects/${projectId}/worker-cache/${issueId}/task-id`)
    return result.taskId
  }
}
