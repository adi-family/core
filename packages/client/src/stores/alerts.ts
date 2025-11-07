/**
 * Global Alerts Store - Valtio state management
 *
 * Provides centralized state for system alerts across the application.
 */
import { z } from 'zod'
import { proxy } from 'valtio'
import { listAlertsConfig } from '@adi/api-contracts'
import type { BaseClient } from '@adi-family/http'

const alertSchema = z.object({
  type: z.literal('missing_api_keys'),
  severity: z.literal('warning'),
  message: z.string(),
  providers: z.array(z.string()),
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    missingProviders: z.array(z.string())
  }))
})

export type Alert = z.infer<typeof alertSchema>

const alertsStoreSchema = z.object({
  alerts: z.array(alertSchema),
  loading: z.boolean(),
  error: z.string().nullable(),
  lastFetch: z.number().nullable()
})

type AlertsStore = z.infer<typeof alertsStoreSchema>

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
  client: BaseClient,
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
export async function refreshAlerts(client: BaseClient) {
  return fetchAlerts(client, true)
}
