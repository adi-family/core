/**
 * Secrets API Contracts
 */

import { z } from 'zod'
import { route, type HandlerConfig } from '@adi-family/http'

/**
 * Get decrypted secret value by ID
 * GET /api/secrets/:id/value
 */
export const getSecretValueConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/:id/value', z.object({ id: z.string() })),
  response: {
    schema: z.object({
      value: z.string()
    })
  }
} as const satisfies HandlerConfig
