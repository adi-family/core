/**
 * Alerts API handlers
 */

import { handler } from '@adi-family/http'
import { listAlertsConfig } from '@adi/api-contracts'

/**
 * Create alert handlers
 */
export function createAlertHandlers() {
  const listAlerts = handler(listAlertsConfig, async () => {
    return { alerts: [] }
  })

  return {
    listAlerts,
  }
}
