import { createLogger } from '@utils/logger'
import { TASK_SYNC_QUEUE } from './queues'
import type { TaskSyncMessage } from './types'
import {channel} from "@queue/connection.ts";

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
