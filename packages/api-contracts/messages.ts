/**
 * Messages API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * List messages
 * GET /api/messages
 */
export const listMessagesConfig = {
  method: 'GET',
  route: route.static('/api/messages'),
  response: {
    schema: z.any()
  }
} as const
