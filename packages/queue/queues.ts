import type { QueueConfig } from './types'

export const TASK_SYNC_QUEUE = 'task-sync'
export const TASK_SYNC_DLQ = 'task-sync.dlq'
export const TASK_SYNC_DLX = 'task-sync.dlx'

export const TASK_SYNC_CONFIG: QueueConfig = {
  name: TASK_SYNC_QUEUE,
  durable: true,
  deadLetterExchange: TASK_SYNC_DLX,
  deadLetterQueue: TASK_SYNC_DLQ,
  messageTtl: 3600000, // 1 hour
  maxRetries: 3
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
  messageTtl: 3600000, // 1 hour
  maxRetries: 3
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
  messageTtl: 7200000, // 2 hours (longer for implementation)
  maxRetries: 3
}

export const TASK_IMPL_DLQ_CONFIG: QueueConfig = {
  name: TASK_IMPL_DLQ,
  durable: true
}
