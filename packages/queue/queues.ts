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
