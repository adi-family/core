/**
 * Alerts API handlers
 */

import { handler } from '@adi-family/http'
import { listAlertsConfig } from '@adi/api-contracts'

/**
 * Create alert handlers
 */
export function createAlertHandlers() {
  /**
   * GET /api/alerts
   * List all alerts
   *
   * Note: Alerts table doesn't exist yet, returning empty array
   */
  const listAlerts = handler(listAlertsConfig, async () => {
    // TODO: Implement alerts table and query
    return { alerts: [] }
  })

  return {
    listAlerts,
  }
}
