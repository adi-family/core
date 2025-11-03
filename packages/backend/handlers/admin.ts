/**
 * Admin API handlers
 * admin-endpoints, usage-metrics
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import { getUsageMetricsConfig } from '@adi/api-contracts/admin'
import { findRecentUsageMetrics, findAggregatedUsageMetrics } from '@adi-simple/db/api-usage-metrics'

/**
 * Create admin handlers
 */
export function createAdminHandlers(sql: Sql) {
  /**
   * GET /admin/usage-metrics
   * Get recent API usage metrics with optional aggregation
   */
  const getUsageMetrics = handler(getUsageMetricsConfig, async ({ query }) => {
    const filters = {
      start_date: query?.start_date,
      end_date: query?.end_date,
      provider: query?.provider,
      goal: query?.goal,
    }

    const limit = query?.limit ?? 100

    const [recent, aggregated] = await Promise.all([
      findRecentUsageMetrics(sql, filters, limit),
      findAggregatedUsageMetrics(sql, filters),
    ])

    return {
      recent,
      aggregated,
    }
  })

  return {
    getUsageMetrics
  }
}
