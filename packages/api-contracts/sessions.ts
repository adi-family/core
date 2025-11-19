/**
 * Session API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'
import { messageSchema, pipelineExecutionSchema, sessionSchema } from '@adi-simple/types'

export const getSessionMessagesConfig = {
  method: 'GET',
  route: route.dynamic('/sessions/:sessionId/messages', z.object({ sessionId: z.string() })),
  response: {
    schema: z.array(messageSchema)
  }
} as const

export const getSessionPipelineExecutionsConfig = {
  method: 'GET',
  route: route.dynamic('/sessions/:sessionId/pipeline-executions', z.object({ sessionId: z.string() })),
  response: {
    schema: z.array(pipelineExecutionSchema)
  }
} as const

export const getSessionConfig = {
  method: 'GET',
  route: route.dynamic('/api/sessions/:id', z.object({ id: z.string() })),
  response: {
    schema: sessionSchema,
  }
} as const

export const listSessionsConfig = {
  method: 'GET',
  route: route.static('/api/sessions'),
  response: {
    schema: z.array(sessionSchema)
  }
} as const
