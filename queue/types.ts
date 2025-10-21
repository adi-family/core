export interface TaskSyncMessage {
  taskSourceId: string
  provider: 'gitlab' | 'jira' | 'github'
  attempt?: number
}

export interface QueueConfig {
  name: string
  durable: boolean
  deadLetterExchange?: string
  deadLetterQueue?: string
  messageTtl?: number
  maxRetries?: number
}
