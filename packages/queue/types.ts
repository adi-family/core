import { z } from 'zod'

export const taskSyncMessageSchema = z.object({
  taskSourceId: z.string(),
  provider: z.enum(['gitlab', 'jira', 'github']),
  attempt: z.number().optional()
})

export type TaskSyncMessage = z.infer<typeof taskSyncMessageSchema>

export const taskEvalMessageSchema = z.object({
  taskId: z.string(),
  attempt: z.number().optional()
})

export type TaskEvalMessage = z.infer<typeof taskEvalMessageSchema>

export const taskImplMessageSchema = z.object({
  taskId: z.string(),
  attempt: z.number().optional()
})

export type TaskImplMessage = z.infer<typeof taskImplMessageSchema>

export const queueConfigSchema = z.object({
  name: z.string(),
  durable: z.boolean(),
  deadLetterExchange: z.string().optional(),
  deadLetterQueue: z.string().optional(),
  messageTtl: z.number().optional(),
  maxRetries: z.number().optional()
})

export type QueueConfig = z.infer<typeof queueConfigSchema>
