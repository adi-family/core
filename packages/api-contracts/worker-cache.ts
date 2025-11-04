/**
 * Worker Cache API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * Get worker cache entries
 * GET /api/worker-cache
 */
export const getWorkerCacheConfig = {
  method: 'GET',
  route: route.static('/api/worker-cache'),
  response: {
    schema: z.any()
  }
} as const
