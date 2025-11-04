/**
 * Session API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

// Message schema - matches database type
const messageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  data: z.any(), // Message data can be any JSON structure
  created_at: z.string().or(z.date())
})

// Pipeline execution schema - matches database type
const pipelineExecutionSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  worker_repository_id: z.string(),
  pipeline_id: z.string(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']),
  last_status_update: z.string().nullable(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date())
})

// Session schema
const sessionSchema = z.object({
  id: z.string(),
  task_id: z.string().nullable(),
  runner: z.string(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date())
})

/**
 * Get messages by session ID
 * GET /sessions/:sessionId/messages
 */
export const getSessionMessagesConfig = {
  method: 'GET',
  route: route.dynamic('/sessions/:sessionId/messages', z.object({ sessionId: z.string() })),
  response: {
    schema: z.array(messageSchema)
  }
} as const

/**
 * Get pipeline executions by session ID
 * GET /sessions/:sessionId/pipeline-executions
 */
export const getSessionPipelineExecutionsConfig = {
  method: 'GET',
  route: route.dynamic('/sessions/:sessionId/pipeline-executions', z.object({ sessionId: z.string() })),
  response: {
    schema: z.array(pipelineExecutionSchema)
  }
} as const

/**
 * Get session by ID
 * GET /api/sessions/:id
 */
export const getSessionConfig = {
  method: 'GET',
  route: route.dynamic('/api/sessions/:id', z.object({ id: z.string() })),
  response: {
    schema: sessionSchema
  }
} as const

/**
 * List all sessions
 * GET /api/sessions
 */
export const listSessionsConfig = {
  method: 'GET',
  route: route.static('/api/sessions'),
  response: {
    schema: z.array(sessionSchema)
  }
} as const
