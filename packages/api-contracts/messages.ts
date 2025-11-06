/**
 * Messages API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * Message schema
 */
const messageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  data: z.unknown(),
  created_at: z.string()
})

/**
 * Message response type (inferred from schema)
 */
export type MessageResponse = z.infer<typeof messageSchema>

/**
 * List messages
 * GET /api/messages
 */
export const listMessagesConfig = {
  method: 'GET',
  route: route.static('/api/messages'),
  response: {
    schema: z.array(messageSchema)
  }
} as const
