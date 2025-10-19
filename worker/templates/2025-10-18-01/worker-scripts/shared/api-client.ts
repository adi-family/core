/**
 * API Client for communicating with our backend
 * Uses Hono RPC for type-safe API calls
 */

import { hc } from 'hono/client'
import type { AppType } from '../../../../../backend/app'
import type { Session, Task, FileSpace } from '../../../../../types'

export type { Session, Task, FileSpace }

export const createApiClient = (baseUrl: string, token: string) => {
  return hc<AppType>(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
}

export type BackendClient = ReturnType<typeof createApiClient>

// Helper to unwrap API responses and throw on error
async function unwrap<T>(response: { ok: boolean; status: number; statusText: string; text: () => Promise<string>; json: () => Promise<unknown> }): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`)
  }
  return await response.json() as T
}

// API Client wrapper class
export class ApiClient {
  private client: BackendClient

  constructor(baseUrl: string, token: string) {
    this.client = createApiClient(baseUrl, token)
  }

  async getSession(sessionId: string): Promise<Session> {
    const res = await this.client.sessions[':id'].$get({ param: { id: sessionId } })
    return unwrap<Session>(res)
  }

  async getTask(taskId: string): Promise<Task> {
    const res = await this.client.tasks[':id'].$get({ param: { id: taskId } })
    return unwrap<Task>(res)
  }

  async getFileSpace(fileSpaceId: string): Promise<FileSpace> {
    const res = await this.client['file-spaces'][':id'].$get({ param: { id: fileSpaceId } })
    return unwrap<FileSpace>(res)
  }

  async createPipelineArtifact(
    executionId: string,
    data: {
      artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit'
      reference_url: string
      metadata?: unknown
    }
  ): Promise<void> {
    const res = await this.client['pipeline-executions'][':executionId'].artifacts.$post({
      param: { executionId },
      json: {
        pipeline_execution_id: executionId,
        ...data
      }
    })
    await unwrap<void>(res)
  }

  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    const res = await this.client.tasks[':id'].$patch({
      param: { id: taskId },
      json: { status }
    })
    await unwrap<Task>(res)
  }
}
