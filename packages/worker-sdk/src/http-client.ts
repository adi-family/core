/**
 * HTTP-based SDK Worker Client
 *
 * This client allows users to create custom workers that poll for tasks via HTTP.
 * Unlike the RabbitMQ-based WorkerClient, this can be run from any machine with
 * internet access - perfect for local Claude Code runners or other custom implementations.
 *
 * Usage:
 *   const sdk = new SdkWorkerClient({
 *     apiUrl: 'https://api.adi.example.com',
 *     apiKey: 'sdk_xxx...'
 *   })
 *
 *   // Start polling for tasks
 *   for await (const task of sdk.pollTasks()) {
 *     console.log('Got task:', task.context.task.title)
 *
 *     // Send progress messages
 *     await sdk.postMessage(task.task.id, 'progress', { step: 1, total: 5 })
 *
 *     // Do your work...
 *     const result = await processTask(task)
 *
 *     // Complete the task
 *     await sdk.finish(task.task.id, 'completed', result)
 *   }
 */

import type {
  SdkWorker,
  SdkWorkerTask,
  SdkWorkerTaskContext,
  SdkWorkerMessage,
  SdkWorkerStatus,
  SdkWorkerCapabilities
} from '@adi-simple/types'

export interface SdkWorkerClientConfig {
  apiUrl: string
  apiKey: string
  pollIntervalMs?: number
  heartbeatIntervalMs?: number
  onError?: (error: Error) => void
}

export interface TaskWithContext {
  task: SdkWorkerTask
  context: SdkWorkerTaskContext
}

export class SdkWorkerClient {
  private config: Required<SdkWorkerClientConfig>
  private isPolling = false
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: SdkWorkerClientConfig) {
    this.config = {
      pollIntervalMs: 5000,
      heartbeatIntervalMs: 30000,
      onError: (err) => console.error('[SdkWorkerClient]', err),
      ...config
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.config.apiUrl}${path}`
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HTTP ${response.status}: ${error}`)
    }

    return response.json()
  }

  /**
   * Send a heartbeat to keep the worker online
   */
  async heartbeat(status?: SdkWorkerStatus, metadata?: Record<string, unknown>): Promise<SdkWorker> {
    return this.request<SdkWorker>('POST', '/api/sdk-workers/heartbeat', {
      status,
      metadata
    })
  }

  /**
   * Start automatic heartbeats to keep the worker online
   */
  startHeartbeat(): void {
    if (this.heartbeatInterval) return

    // Send initial heartbeat
    this.heartbeat('online').catch(this.config.onError)

    this.heartbeatInterval = setInterval(() => {
      this.heartbeat('online').catch(this.config.onError)
    }, this.config.heartbeatIntervalMs)
  }

  /**
   * Stop automatic heartbeats
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Get the next available task (single poll)
   */
  async getNext(): Promise<TaskWithContext | null> {
    const response = await this.request<{
      task: SdkWorkerTask | null
      context: SdkWorkerTaskContext | null
    }>('GET', '/api/sdk-workers/next')

    if (!response.task || !response.context) {
      return null
    }

    return {
      task: response.task,
      context: response.context
    }
  }

  /**
   * Send a message from the worker to the server
   */
  async postMessage(
    taskId: string,
    messageType: string,
    payload: unknown
  ): Promise<SdkWorkerMessage> {
    return this.request<SdkWorkerMessage>('POST', '/api/sdk-workers/message', {
      taskId,
      messageType,
      payload
    })
  }

  /**
   * Mark a task as completed or failed
   */
  async finish(
    taskId: string,
    status: 'completed' | 'failed',
    resultOrError?: unknown
  ): Promise<SdkWorkerTask> {
    const body: Record<string, unknown> = { taskId, status }

    if (status === 'completed') {
      body.result = resultOrError
    } else {
      body.error = resultOrError || { code: 'UNKNOWN', message: 'Task failed' }
    }

    return this.request<SdkWorkerTask>('POST', '/api/sdk-workers/finish', body)
  }

  /**
   * Get messages sent to this task from the server
   */
  async getMessages(taskId: string): Promise<SdkWorkerMessage[]> {
    return this.request<SdkWorkerMessage[]>('GET', `/api/sdk-workers/tasks/${taskId}/messages`)
  }

  /**
   * Poll for tasks continuously using an async generator
   *
   * Usage:
   *   for await (const task of sdk.pollTasks()) {
   *     // process task
   *   }
   */
  async *pollTasks(): AsyncGenerator<TaskWithContext, void, unknown> {
    this.isPolling = true
    this.startHeartbeat()

    try {
      while (this.isPolling) {
        try {
          const task = await this.getNext()

          if (task) {
            yield task
          } else {
            // No task available, wait before next poll
            await this.sleep(this.config.pollIntervalMs)
          }
        } catch (error) {
          this.config.onError(error instanceof Error ? error : new Error(String(error)))
          await this.sleep(this.config.pollIntervalMs)
        }
      }
    } finally {
      this.stopHeartbeat()
      // Send offline heartbeat
      try {
        await this.heartbeat('offline')
      } catch {
        // Ignore errors when going offline
      }
    }
  }

  /**
   * Stop polling for tasks
   */
  stopPolling(): void {
    this.isPolling = false
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.stopPolling()
    this.stopHeartbeat()
    try {
      await this.heartbeat('offline')
    } catch {
      // Ignore errors when shutting down
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Helper to register a new SDK worker and get back the client
 * This is typically a one-time operation - save the returned apiKey!
 */
export async function registerSdkWorker(options: {
  apiUrl: string
  projectId: string
  authToken: string // User's auth token (Clerk JWT)
  name: string
  description?: string
  capabilities?: Partial<SdkWorkerCapabilities>
}): Promise<{ worker: SdkWorker; apiKey: string; client: SdkWorkerClient }> {
  const response = await fetch(
    `${options.apiUrl}/api/projects/${options.projectId}/sdk-workers/register`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${options.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        capabilities: options.capabilities
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to register worker: ${error}`)
  }

  const { worker, apiKey } = await response.json()

  const client = new SdkWorkerClient({
    apiUrl: options.apiUrl,
    apiKey
  })

  return { worker, apiKey, client }
}
