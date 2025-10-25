import type { Sql } from 'postgres'
import type { ConsumeMessage } from 'amqplib'
import { createLogger } from '@utils/logger'
import { TASK_SYNC_QUEUE, TASK_SYNC_CONFIG, TASK_EVAL_QUEUE, TASK_EVAL_CONFIG, TASK_IMPL_QUEUE, TASK_IMPL_CONFIG } from './queues'
import type { TaskSyncMessage, TaskEvalMessage, TaskImplMessage } from './types'
import { syncTaskSource } from '@micros-task-sync/service'
import { evaluateTask } from '@micros-task-eval/service'
import { implementTask } from '@adi/micros-task-impl/service'
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

export async function startTaskEvalConsumer(sql: Sql): Promise<void> {
  try {
    const ch = await channel.value;

    await ch.prefetch(5)

    logger.info(`Starting consumer for queue: ${TASK_EVAL_QUEUE}`)

    await ch.consume(TASK_EVAL_QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) {
        return
      }

      try {
        await processTaskEvalMessage(sql, msg)
        ch.ack(msg)
      } catch (error) {
        logger.error('Failed to process task eval message:', error)

        const attempt = (msg.properties.headers?.['x-attempt'] || 0) + 1
        const maxRetries = TASK_EVAL_CONFIG.maxRetries || 3

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

    logger.info('Task eval consumer started successfully')
  } catch (error) {
    logger.error('Failed to start task eval consumer:', error)
    throw error
  }
}

async function processTaskEvalMessage(sql: Sql, msg: ConsumeMessage): Promise<void> {
  const message: TaskEvalMessage = JSON.parse(msg.content.toString())

  logger.debug(`Processing task eval message for task ${message.taskId}`)

  const result = await evaluateTask(sql, {
    taskId: message.taskId
  })

  logger.info(`Task ${message.taskId} evaluation completed: sessionId=${result.sessionId}, pipelineUrl=${result.pipelineUrl || 'N/A'}, ${result.errors.length} errors`)

  if (result.errors.length > 0) {
    logger.error(`Errors during task evaluation:`, result.errors)
  }
}

export async function startTaskImplConsumer(sql: Sql): Promise<void> {
  try {
    const ch = await channel.value;

    await ch.prefetch(3)

    logger.info(`Starting consumer for queue: ${TASK_IMPL_QUEUE}`)

    await ch.consume(TASK_IMPL_QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) {
        return
      }

      try {
        await processTaskImplMessage(sql, msg)
        ch.ack(msg)
      } catch (error) {
        logger.error('Failed to process task impl message:', error)

        const attempt = (msg.properties.headers?.['x-attempt'] || 0) + 1
        const maxRetries = TASK_IMPL_CONFIG.maxRetries || 3

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

    logger.info('Task impl consumer started successfully')
  } catch (error) {
    logger.error('Failed to start task impl consumer:', error)
    throw error
  }
}

async function processTaskImplMessage(sql: Sql, msg: ConsumeMessage): Promise<void> {
  const message: TaskImplMessage = JSON.parse(msg.content.toString())

  logger.debug(`Processing task impl message for task ${message.taskId}`)

  const result = await implementTask(sql, {
    taskId: message.taskId
  })

  logger.info(`Task ${message.taskId} implementation completed: sessionId=${result.sessionId}, pipelineUrl=${result.pipelineUrl || 'N/A'}, ${result.errors.length} errors`)

  if (result.errors.length > 0) {
    logger.error(`Errors during task implementation:`, result.errors)
  }
}
