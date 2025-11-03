/**
 * Session API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

// Message schema - matches database type
const messageSchema = z.any()  // Temporarily use any for rapid conversion

// Pipeline execution schema - matches database type
const pipelineExecutionSchema = z.any()  // Temporarily use any for rapid conversion

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
    schema: z.any()  // Temporarily use any for rapid conversion
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
    schema: z.any()
  }
} as const
