import type { Sql } from 'postgres'
import type { ConsumeMessage } from 'amqplib'
import { createLogger } from '@utils/logger'
import { TASK_SYNC_QUEUE, TASK_SYNC_CONFIG, TASK_EVAL_QUEUE, TASK_EVAL_CONFIG, TASK_IMPL_QUEUE, TASK_IMPL_CONFIG } from '@adi/queue/queues.ts'
import type { TaskSyncMessage, TaskEvalMessage, TaskImplMessage } from '@adi/queue/types.ts'
import { syncTaskSource } from '@micros-task-sync/service'
import { evaluateTask } from '@micros-task-eval/service'
import { implementTask } from '@adi/micros-task-impl/service'
import { channel } from '@adi/queue/connection.ts'

const logger = createLogger({ namespace: 'queue-consumer' })

export interface Runner {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

export function createTaskSyncConsumer(sql: Sql): Runner {
  let consumerTag: string | null = null

  return {
    start: async () => {
      if (consumerTag) {
        logger.warn('Task sync consumer already running')
        return
      }

      try {
        const ch = await channel.value;

        await ch.prefetch(10)

        logger.info(`Starting consumer for queue: ${TASK_SYNC_QUEUE}`)

        const result = await ch.consume(TASK_SYNC_QUEUE, async (msg: ConsumeMessage | null) => {
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
          noAck: false,
          consumerTag: `task-sync-${process.pid}-${Date.now()}`
        })

        consumerTag = result.consumerTag

        logger.info('Task sync consumer started successfully')
      } catch (error) {
        logger.error('Failed to start task sync consumer:', error)
        throw error
      }
    },

    stop: async () => {
      if (consumerTag) {
        try {
          const ch = await channel.value;
          await ch.cancel(consumerTag)
          consumerTag = null
          logger.info('Task sync consumer stopped')
        } catch (error) {
          logger.error('Failed to stop task sync consumer:', error)
        }
      }
    }
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

export function createTaskEvalConsumer(sql: Sql): Runner {
  let consumerTag: string | null = null

  return {
    start: async () => {
      if (consumerTag) {
        logger.warn('Task eval consumer already running')
        return
      }

      try {
        const ch = await channel.value;

        await ch.prefetch(5)

        logger.info(`Starting consumer for queue: ${TASK_EVAL_QUEUE}`)

        const result = await ch.consume(TASK_EVAL_QUEUE, async (msg: ConsumeMessage | null) => {
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
          noAck: false,
          consumerTag: `task-eval-${process.pid}-${Date.now()}`
        })

        consumerTag = result.consumerTag

        logger.info('Task eval consumer started successfully')
      } catch (error) {
        logger.error('Failed to start task eval consumer:', error)
        throw error
      }
    },

    stop: async () => {
      if (consumerTag) {
        try {
          const ch = await channel.value;
          await ch.cancel(consumerTag)
          consumerTag = null
          logger.info('Task eval consumer stopped')
        } catch (error) {
          logger.error('Failed to stop task eval consumer:', error)
        }
      }
    }
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

export function createTaskImplConsumer(sql: Sql): Runner {
  let consumerTag: string | null = null

  return {
    start: async () => {
      if (consumerTag) {
        logger.warn('Task impl consumer already running')
        return
      }

      try {
        const ch = await channel.value;

        await ch.prefetch(3)

        logger.info(`Starting consumer for queue: ${TASK_IMPL_QUEUE}`)

        const result = await ch.consume(TASK_IMPL_QUEUE, async (msg: ConsumeMessage | null) => {
          if (!msg) {
            logger.warn('Received null message in task-impl consumer')
            return
          }

          logger.debug(`📨 Task impl consumer received message`)

          try {
            await processTaskImplMessage(sql, msg)
            ch.ack(msg)
          } catch (error) {
            logger.error('❌ EXCEPTION while processing task impl message:', error)
            logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')

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
          noAck: false,
          consumerTag: `task-impl-${process.pid}-${Date.now()}`
        })

        consumerTag = result.consumerTag

        logger.info('Task impl consumer started successfully')
      } catch (error) {
        logger.error('Failed to start task impl consumer:', error)
        throw error
      }
    },

    stop: async () => {
      if (consumerTag) {
        try {
          const ch = await channel.value;
          await ch.cancel(consumerTag)
          consumerTag = null
          logger.info('Task impl consumer stopped')
        } catch (error) {
          logger.error('Failed to stop task impl consumer:', error)
        }
      }
    }
  }
}

async function processTaskImplMessage(sql: Sql, msg: ConsumeMessage): Promise<void> {
  const message: TaskImplMessage = JSON.parse(msg.content.toString())

  logger.info(`🚀 Starting implementation for task ${message.taskId}`)

  const result = await implementTask(sql, {
    taskId: message.taskId
  })

  if (result.errors.length > 0) {
    logger.error(`❌ Task ${message.taskId} implementation FAILED:`)
    result.errors.forEach((error, i) => {
      logger.error(`  Error ${i + 1}: ${error}`)
    })
  } else {
    logger.info(`✅ Task ${message.taskId} implementation completed successfully: sessionId=${result.sessionId}, pipelineUrl=${result.pipelineUrl || 'N/A'}`)
  }
}
