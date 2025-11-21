import type { Sql } from 'postgres'
import type { ConsumeMessage } from 'amqplib'
import { createLogger } from '@utils/logger'
import { TASK_SYNC_QUEUE, TASK_SYNC_CONFIG, TASK_EVAL_QUEUE, TASK_EVAL_CONFIG, TASK_IMPL_QUEUE, TASK_IMPL_CONFIG } from '@adi/queue/queues'
import type { TaskSyncMessage, TaskEvalMessage, TaskImplMessage } from '@adi/queue/types'
import { syncTaskSource } from '@micros-task-sync/service'
import { evaluateTask } from '@micros-task-eval/service'
import { implementTask } from '@adi/micros-task-impl/service'
import { createQueueConsumer, type Runner } from '@adi/queue/consumer-factory'

const logger = createLogger({ namespace: 'queue-consumer' })

export function createTaskSyncConsumer(sql: Sql): Runner {
  return createQueueConsumer(sql, {
    queueName: TASK_SYNC_QUEUE,
    queueConfig: TASK_SYNC_CONFIG,
    prefetchCount: 10,
    consumerLabel: 'task-sync',
    processMessage: processTaskSyncMessage
  })
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
  return createQueueConsumer(sql, {
    queueName: TASK_EVAL_QUEUE,
    queueConfig: TASK_EVAL_CONFIG,
    prefetchCount: 5,
    consumerLabel: 'task-eval',
    processMessage: processTaskEvalMessage
  })
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
  return createQueueConsumer(sql, {
    queueName: TASK_IMPL_QUEUE,
    queueConfig: TASK_IMPL_CONFIG,
    prefetchCount: 3,
    consumerLabel: 'task-impl',
    processMessage: processTaskImplMessage
  })
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
