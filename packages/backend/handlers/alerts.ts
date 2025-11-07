import { handler } from '@adi-family/http'
import { listAlertsConfig } from '@adi/api-contracts'

export function createAlertHandlers() {
  const listAlerts = handler(listAlertsConfig, async () => {
    return { alerts: [] }
  })

  return {
    listAlerts,
  }
}
