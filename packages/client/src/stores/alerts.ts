/**
 * Global Alerts Store - Valtio state management
 *
 * Provides centralized state for system alerts across the application.
 */
import { proxy } from 'valtio'
import { listAlertsConfig } from '@adi/api-contracts'
import type { AuthenticatedClient } from '@/lib/client'

export interface Alert {
  type: 'missing_api_keys'
  severity: 'warning'
  message: string
  providers: string[]
  projects: { id: string; name: string; missingProviders: string[] }[]
}

interface AlertsStore {
  alerts: Alert[]
  loading: boolean
  error: string | null
  lastFetch: number | null
}

export const alertsStore = proxy<AlertsStore>({
  alerts: [],
  loading: false,
  error: null,
  lastFetch: null,
})

/**
 * Fetch alerts from the API
 * Caches results to avoid duplicate calls within 30 seconds
 */
export async function fetchAlerts(
  client: AuthenticatedClient,
  force = false
) {
  const now = Date.now()
  const CACHE_DURATION = 30_000 // 30 seconds

  // Skip if recently fetched (unless forced)
  if (!force && alertsStore.lastFetch && now - alertsStore.lastFetch < CACHE_DURATION) {
    return
  }

  alertsStore.loading = true
  alertsStore.error = null

  try {
    const data = await client.run(listAlertsConfig)
    alertsStore.alerts = data.alerts
    alertsStore.lastFetch = now
  } catch (error) {
    alertsStore.error = error instanceof Error ? error.message : 'Failed to fetch alerts'
    console.error('Error fetching alerts:', error)
    // Set empty array on error to avoid showing stale data
    alertsStore.alerts = []
  } finally {
    alertsStore.loading = false
  }
}

/**
 * Force refresh alerts from API
 */
export async function refreshAlerts(client: AuthenticatedClient) {
  return fetchAlerts(client, true)
}
