import type { Sql } from 'postgres'
import type { ConsumeMessage } from 'amqplib'
import { createLogger } from '@utils/logger'
import { TASK_SYNC_QUEUE, TASK_SYNC_CONFIG } from './queues'
import type { TaskSyncMessage } from './types'
import { syncTaskSource } from '../daemon-task-sync/service'
import {channel} from "./connection.ts";

const logger = createLogger({ namespace: 'queue-consumer' })

export async function startTaskSyncConsumer(sql: Sql): Promise<void> {
  try {
    const ch = await channel.value;

    await ch.prefetch(10)

    logger.info(`Starting consumer for queue: ${TASK_SYNC_QUEUE}`)

    await ch.consume(TASK_SYNC_QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) {
        return
      }

      try {
        await processTaskSyncMessage(sql, msg)
        ch.ack(msg)
      } catch (error) {
        logger.error('Failed to process task sync message:', error)

        const attempt = (msg.properties.headers?.['x-attempt'] || 0) + 1
        const maxRetries = TASK_SYNC_CONFIG.maxRetries || 3

        if (attempt >= maxRetries) {
          logger.error(`Message exceeded max retries (${maxRetries}), sending to DLQ`)
          ch.nack(msg, false, false)
        } else {
          logger.warn(`Retrying message (attempt ${attempt}/${maxRetries})`)
          ch.nack(msg, false, true)
        }
      }
    }, {
      noAck: false
    })

    logger.info('Task sync consumer started successfully')
  } catch (error) {
    logger.error('Failed to start task sync consumer:', error)
    throw error
  }
}

async function processTaskSyncMessage(sql: Sql, msg: ConsumeMessage): Promise<void> {
  const message: TaskSyncMessage = JSON.parse(msg.content.toString())

  logger.debug(`Processing task sync message for task source ${message.taskSourceId} (${message.provider})`)

  const result = await syncTaskSource(sql, {
    taskSourceId: message.taskSourceId,
    provider: message.provider
  })

  logger.info(`${message.provider} task source ${message.taskSourceId} sync completed: ${result.tasksCreated} created, ${result.tasksUpdated} updated, ${result.errors.length} errors`)

  if (result.errors.length > 0) {
    logger.error(`Errors during ${message.provider} sync:`, result.errors)
  }
}
