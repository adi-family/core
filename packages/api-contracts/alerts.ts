/**
 * Alerts API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * List alerts
 * GET /api/alerts
 */
export const listAlertsConfig = {
  method: 'GET',
  route: route.static('/api/alerts'),
  response: {
    schema: z.any()
  }
} as const
