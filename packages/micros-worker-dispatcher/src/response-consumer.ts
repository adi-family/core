/**
 * Worker Response Consumer
 * Consumes responses from custom workers and updates database
 */

import * as amqp from 'amqplib'
import type { WorkerResponseMessage } from '@adi-simple/types'
import { WORKER_RESPONSES_QUEUE } from '@adi-simple/queue/queues'
import { createLogger } from '@utils/logger'
import { sql } from '@db/client'
import { findSessionById } from '@db/sessions'

const logger = createLogger({ namespace: 'worker-response-consumer' })

export class ResponseConsumer {
  private connection: amqp.Connection | null = null
  private channel: amqp.Channel | null = null
  private rabbitmqUrl: string

  constructor(rabbitmqUrl: string) {
    this.rabbitmqUrl = rabbitmqUrl
  }

  async connect(): Promise<void> {
    this.connection = await amqp.connect(this.rabbitmqUrl)
    this.channel = await this.connection.createChannel()

    // Assert queue exists
    await this.channel.assertQueue(WORKER_RESPONSES_QUEUE, { durable: true })

    // Set prefetch to process one message at a time
    await this.channel.prefetch(1)

    logger.info(`Connected to RabbitMQ and listening on ${WORKER_RESPONSES_QUEUE}`)
  }

  async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected. Call connect() first.')
    }

    await this.channel.consume(WORKER_RESPONSES_QUEUE, async (msg) => {
      if (!msg || !this.channel) return

      try {
        const response: WorkerResponseMessage = JSON.parse(msg.content.toString())

        logger.info(`Received response for session ${response.sessionId} with status ${response.status}`)

        await this.processResponse(response)

        // Acknowledge message
        this.channel.ack(msg)

        logger.info(`Successfully processed response for session ${response.sessionId}`)

      } catch (error) {
        logger.error(`Error processing worker response:`, error)

        // Reject and requeue the message
        if (this.channel) {
          this.channel.nack(msg, false, true)
        }
      }
    })
  }

  private async processResponse(response: WorkerResponseMessage): Promise<void> {
    const { sessionId, status, result, error, metadata } = response

    // Fetch session
    const session = await findSessionById(sql, sessionId)
    if (!session) {
      logger.warn(`Session not found: ${sessionId}`)
      return
    }

    // TODO: Update session with result
    // This would involve:
    // 1. Storing the result in appropriate tables (evaluation_results, implementation_results)
    // 2. Updating task status
    // 3. Creating artifacts if any
    // 4. Updating session status

    if (status === 'success') {
      logger.info(`Task ${session.runner} completed successfully for session ${sessionId}`)
      logger.info(`Execution time: ${metadata.executionTimeMs}ms, Worker version: ${metadata.workerVersion}`)

      // Store result based on task type
      if (result?.evaluation) {
        logger.info(`Storing evaluation result for session ${sessionId}`)
        // TODO: Store evaluation result
      }

      if (result?.implementation) {
        logger.info(`Storing implementation result for session ${sessionId}`)
        // TODO: Store implementation result
      }

      if (result?.artifacts && result.artifacts.length > 0) {
        logger.info(`Storing ${result.artifacts.length} artifacts for session ${sessionId}`)
        // TODO: Store artifacts
      }

    } else if (status === 'error') {
      logger.error(`Task failed for session ${sessionId}: ${error?.message}`)
      logger.error(`Error code: ${error?.code}`)

      // TODO: Update session/task with error status
    } else if (status === 'timeout') {
      logger.warn(`Task timed out for session ${sessionId}`)

      // TODO: Update session/task with timeout status
    }
  }

  async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close()
    }
    if (this.connection) {
      await this.connection.close()
    }
    logger.info('Disconnected from RabbitMQ')
  }
}
