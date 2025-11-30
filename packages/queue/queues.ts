import type { QueueConfig } from './types'
import { QUEUE_DEFAULTS } from '@adi-simple/config'

export const TASK_SYNC_QUEUE = 'task-sync'
export const TASK_SYNC_DLQ = 'task-sync.dlq'
export const TASK_SYNC_DLX = 'task-sync.dlx'

export const TASK_SYNC_CONFIG: QueueConfig = {
  name: TASK_SYNC_QUEUE,
  durable: true,
  deadLetterExchange: TASK_SYNC_DLX,
  deadLetterQueue: TASK_SYNC_DLQ,
  messageTtl: QUEUE_DEFAULTS.messageRetention.sync,
  maxRetries: QUEUE_DEFAULTS.maxRetries
}

export const TASK_SYNC_DLQ_CONFIG: QueueConfig = {
  name: TASK_SYNC_DLQ,
  durable: true
}

export const TASK_EVAL_QUEUE = 'task-eval'
export const TASK_EVAL_DLQ = 'task-eval.dlq'
export const TASK_EVAL_DLX = 'task-eval.dlx'

export const TASK_EVAL_CONFIG: QueueConfig = {
  name: TASK_EVAL_QUEUE,
  durable: true,
  deadLetterExchange: TASK_EVAL_DLX,
  deadLetterQueue: TASK_EVAL_DLQ,
  messageTtl: QUEUE_DEFAULTS.messageRetention.evaluation,
  maxRetries: QUEUE_DEFAULTS.maxRetries
}

export const TASK_EVAL_DLQ_CONFIG: QueueConfig = {
  name: TASK_EVAL_DLQ,
  durable: true
}

export const TASK_IMPL_QUEUE = 'task-impl'
export const TASK_IMPL_DLQ = 'task-impl.dlq'
export const TASK_IMPL_DLX = 'task-impl.dlx'

export const TASK_IMPL_CONFIG: QueueConfig = {
  name: TASK_IMPL_QUEUE,
  durable: true,
  deadLetterExchange: TASK_IMPL_DLX,
  deadLetterQueue: TASK_IMPL_DLQ,
  messageTtl: QUEUE_DEFAULTS.messageRetention.implementation,
  maxRetries: QUEUE_DEFAULTS.maxRetries
}

export const TASK_IMPL_DLQ_CONFIG: QueueConfig = {
  name: TASK_IMPL_DLQ,
  durable: true
}

// Worker queues for adi-runner microservice (renamed from custom-microservice)
export const WORKER_TASKS_QUEUE = 'worker-tasks'
export const WORKER_TASKS_DLQ = 'worker-tasks.dlq'
export const WORKER_TASKS_DLX = 'worker-tasks.dlx'

export const WORKER_TASKS_CONFIG: QueueConfig = {
  name: WORKER_TASKS_QUEUE,
  durable: true,
  deadLetterExchange: WORKER_TASKS_DLX,
  deadLetterQueue: WORKER_TASKS_DLQ,
  messageTtl: 3600000, // 1 hour
  maxRetries: 3
}

export const WORKER_TASKS_DLQ_CONFIG: QueueConfig = {
  name: WORKER_TASKS_DLQ,
  durable: true
}

export const WORKER_RESPONSES_QUEUE = 'worker-responses'

export const WORKER_RESPONSES_CONFIG: QueueConfig = {
  name: WORKER_RESPONSES_QUEUE,
  durable: true,
  messageTtl: 86400000 // 24 hours
}
