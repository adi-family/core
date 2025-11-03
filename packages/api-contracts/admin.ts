/**
 * Admin API contracts
 * admin-endpoints, usage-metrics
 */

import { route } from '@adi-family/http'
import { z } from 'zod'

/**
 * Get recent API usage metrics
 * GET /admin/usage-metrics
 */
export const getUsageMetricsConfig = {
  method: 'GET',
  route: route.static('/admin/usage-metrics'),
  query: {
    schema: z.object({
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      provider: z.string().optional(),
      goal: z.string().optional(),
      limit: z.coerce.number().optional(),
    }).optional()
  },
  response: {
    schema: z.object({
      recent: z.array(z.any()),
      aggregated: z.array(z.any()).optional(),
    })
  }
} as const

/**
 * Get worker repositories
 * GET /admin/worker-repos
 */
export const getWorkerReposConfig = {
  method: 'GET',
  route: route.static('/admin/worker-repos'),
  response: {
    schema: z.any()
  }
} as const

/**
 * Refresh worker repositories
 * POST /admin/refresh-worker-repos
 */
export const refreshWorkerReposConfig = {
  method: 'POST',
  route: route.static('/admin/refresh-worker-repos'),
  body: {
    schema: z.any().optional()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Execute admin operation
 * POST /admin/operations/:operation
 */
export const executeAdminOperationConfig = {
  method: 'POST',
  route: route.dynamic('/admin/operations/:operation', z.object({ operation: z.string() })),
  body: {
    schema: z.any().optional()
  },
  response: {
    schema: z.any()
  }
} as const
