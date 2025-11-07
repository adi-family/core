/**
 * Messages API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

const messageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  data: z.unknown(),
  created_at: z.string()
})

export type MessageResponse = z.infer<typeof messageSchema>

export const listMessagesConfig = {
  method: 'GET',
  route: route.static('/api/messages'),
  response: {
    schema: z.array(messageSchema)
  }
} as const
