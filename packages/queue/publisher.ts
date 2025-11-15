import { createLogger } from '@utils/logger'
import { TASK_SYNC_QUEUE, TASK_EVAL_QUEUE, TASK_IMPL_QUEUE } from './queues'
import type { TaskSyncMessage, TaskEvalMessage, TaskImplMessage } from './types'
import { channel } from "@adi/queue/connection";
import type { Options } from 'amqplib'

const logger = createLogger({ namespace: 'queue-publisher' })

interface PublishOptions {
  persistent?: boolean
  correlationId?: string
  replyTo?: string
}

/**
 * Create a generic publisher for any queue
 */
export async function createPublisher() {
  const ch = await channel.value

  return {
    async publish<T = any>(queue: string, message: T, options: PublishOptions = {}): Promise<void> {
      try {
        const buffer = Buffer.from(JSON.stringify(message))

        const publishOptions: Options.Publish = {
          persistent: options.persistent ?? true,
          contentType: 'application/json'
        }

        if (options.correlationId) {
          publishOptions.correlationId = options.correlationId
        }

        if (options.replyTo) {
          publishOptions.replyTo = options.replyTo
        }

        const sent = ch.sendToQueue(queue, buffer, publishOptions)

        if (!sent) {
          logger.warn(`Queue ${queue} is full, message may be buffered`)
        }

        logger.debug(`Published message to queue ${queue}`)
      } catch (error) {
        logger.error(`Failed to publish message to queue ${queue}:`, error)
        throw error
      }
    }
  }
}

export async function publishTaskSync(message: TaskSyncMessage): Promise<void> {
  try {
    const ch = await channel.value;

    const buffer = Buffer.from(JSON.stringify(message))

    const sent = ch.sendToQueue(TASK_SYNC_QUEUE, buffer, {
      persistent: true,
      contentType: 'application/json'
    })

    if (!sent) {
      logger.warn(`Queue ${TASK_SYNC_QUEUE} is full, message may be buffered`)
    }

    logger.debug(`Published task sync message for task source ${message.taskSourceId}`)
  } catch (error) {
    logger.error('Failed to publish task sync message:', error)
    throw error
  }
}

export async function publishTaskEval(message: TaskEvalMessage): Promise<void> {
  try {
    const ch = await channel.value;

    const buffer = Buffer.from(JSON.stringify(message))

    const sent = ch.sendToQueue(TASK_EVAL_QUEUE, buffer, {
      persistent: true,
      contentType: 'application/json'
    })

    if (!sent) {
      logger.warn(`Queue ${TASK_EVAL_QUEUE} is full, message may be buffered`)
    }

    logger.debug(`Published task evaluation message for task ${message.taskId}`)
  } catch (error) {
    logger.error('Failed to publish task evaluation message:', error)
    throw error
  }
}

export async function publishTaskImpl(message: TaskImplMessage): Promise<void> {
  try {
    const ch = await channel.value;

    const buffer = Buffer.from(JSON.stringify(message))

    logger.debug(`📤 Sending to queue "${TASK_IMPL_QUEUE}": ${JSON.stringify(message)}`)

    const sent = ch.sendToQueue(TASK_IMPL_QUEUE, buffer, {
      persistent: true,
      contentType: 'application/json'
    })

    if (!sent) {
      logger.warn(`Queue ${TASK_IMPL_QUEUE} is full, message may be buffered`)
    } else {
      logger.debug(`✓ Published task implementation message for task ${message.taskId}`)
    }
  } catch (error) {
    logger.error('Failed to publish task implementation message:', error)
    throw error
  }
}
