/**
 * Healthcheck API Contract
 */

import { z } from 'zod'
import { route, type HandlerConfig } from '@adi-family/http'

/**
 * Healthcheck endpoint
 * GET /healthcheck
 */
export const healthcheckConfig = {
  method: 'GET',
  route: route.static('/healthcheck'),
  response: {
    schema: z.object({
      status: z.string(),
      timestamp: z.string()
    })
  }
} as const satisfies HandlerConfig
