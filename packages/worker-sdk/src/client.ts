import * as amqp from 'amqplib'
import type { WorkerTaskMessage, WorkerResponseMessage } from '@adi-simple/types'
import { WORKER_TASKS_QUEUE, WORKER_RESPONSES_QUEUE } from '@adi-simple/queue/queues'

export interface WorkerConfig {
  rabbitmqUrl: string
  workerName: string
  concurrency?: number
}

export interface TaskHandler {
  onEvaluate(task: WorkerTaskMessage): Promise<any>
  onImplement(task: WorkerTaskMessage): Promise<any>
  onCancel?(sessionId: string): Promise<void>
}

export class WorkerClient {
  private connection: amqp.Connection | null = null
  private channel: amqp.Channel | null = null
  private config: WorkerConfig
  private activeTasks = new Map<string, boolean>()

  constructor(config: WorkerConfig) {
    this.config = {
      ...config,
      concurrency: config.concurrency || 5
    }
  }

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.config.rabbitmqUrl)
    this.channel = await this.connection.createChannel()

    // Set prefetch to control concurrency
    await this.channel.prefetch(this.config.concurrency!)

    // Assert queues exist
    await this.channel.assertQueue(WORKER_TASKS_QUEUE, { durable: true })
    await this.channel.assertQueue(WORKER_RESPONSES_QUEUE, { durable: true })

    console.log(`[${this.config.workerName}] Connected to RabbitMQ`)
  }

  async listen(handler: TaskHandler): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected. Call connect() first.')
    }

    console.log(`[${this.config.workerName}] Listening for tasks on queue: ${WORKER_TASKS_QUEUE}`)

    await this.channel.consume(WORKER_TASKS_QUEUE, async (msg) => {
      if (!msg || !this.channel) return

      const startTime = Date.now()
      let taskMessage: WorkerTaskMessage

      try {
        taskMessage = JSON.parse(msg.content.toString()) as WorkerTaskMessage

        console.log(`[${this.config.workerName}] Received task ${taskMessage.taskType} for session ${taskMessage.sessionId}`)

        this.activeTasks.set(taskMessage.sessionId, true)

        let result: any

        // Route to appropriate handler
        if (taskMessage.taskType === 'evaluation') {
          result = await handler.onEvaluate(taskMessage)
        } else if (taskMessage.taskType === 'implementation') {
          result = await handler.onImplement(taskMessage)
        } else {
          throw new Error(`Unknown task type: ${taskMessage.taskType}`)
        }

        // Send success response
        await this.sendResult(taskMessage, {
          correlationId: taskMessage.correlationId,
          sessionId: taskMessage.sessionId,
          status: 'success',
          result: {
            [taskMessage.taskType]: result
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            workerVersion: '1.0.0'
          }
        })

        // Acknowledge message
        this.channel!.ack(msg)

        console.log(`[${this.config.workerName}] Completed task for session ${taskMessage.sessionId}`)

      } catch (error) {
        console.error(`[${this.config.workerName}] Error processing task:`, error)

        try {
          if (taskMessage!) {
            // Send error response
            await this.sendResult(taskMessage, {
              correlationId: taskMessage.correlationId,
              sessionId: taskMessage.sessionId,
              status: 'error',
              error: {
                code: 'WORKER_ERROR',
                message: error instanceof Error ? error.message : String(error),
                details: error
              },
              metadata: {
                executionTimeMs: Date.now() - startTime,
                workerVersion: '1.0.0'
              }
            })
          }
        } catch (responseError) {
          console.error(`[${this.config.workerName}] Failed to send error response:`, responseError)
        }

        // Reject and requeue the message
        this.channel!.nack(msg, false, false)
      } finally {
        if (taskMessage!) {
          this.activeTasks.delete(taskMessage.sessionId)
        }
      }
    })
  }

  private async sendResult(taskMessage: WorkerTaskMessage, response: WorkerResponseMessage): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not available')
    }

    await this.channel.sendToQueue(
      WORKER_RESPONSES_QUEUE,
      Buffer.from(JSON.stringify(response)),
      {
        persistent: true,
        correlationId: taskMessage.correlationId
      }
    )
  }

  async updateProgress(sessionId: string, progress: number): Promise<void> {
    // Progress updates could be sent via a separate queue or logged
    console.log(`[${this.config.workerName}] Progress for ${sessionId}: ${progress}%`)
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close()
    }
    if (this.connection) {
      await this.connection.close()
    }
    console.log(`[${this.config.workerName}] Disconnected from RabbitMQ`)
  }

  getActiveTaskCount(): number {
    return this.activeTasks.size
  }
}
