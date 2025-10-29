import { createLogger } from '@utils/logger'
import { TASK_SYNC_QUEUE, TASK_EVAL_QUEUE, TASK_IMPL_QUEUE } from './queues'
import type { TaskSyncMessage, TaskEvalMessage, TaskImplMessage } from './types'
import {channel} from "@adi/queue/connection";

const logger = createLogger({ namespace: 'queue-publisher' })

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
