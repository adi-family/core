/**
 * Global Usage Metrics Store - Valtio state management
 *
 * Provides centralized state for API usage metrics across the application.
 */
import { proxy } from 'valtio'
import { getUsageMetricsConfig } from '@adi/api-contracts'
import type { AuthenticatedClient } from '@/lib/client'

export interface ApiUsageMetric {
  id: string
  pipeline_execution_id: string | null
  session_id: string | null
  task_id: string | null
  provider: string
  model: string
  goal: string
  operation_phase: string
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  ci_duration_seconds: number | null
  iteration_number: number | null
  metadata: any | null
  created_at: Date | string
}

interface UsageMetricsStore {
  metrics: ApiUsageMetric[]
  loading: boolean
  error: string | null
  lastFetch: number | null
}

export const usageMetricsStore = proxy<UsageMetricsStore>({
  metrics: [],
  loading: false,
  error: null,
  lastFetch: null,
})

/**
 * Fetch usage metrics from the API
 * Supports optional filtering by start_date, end_date, provider, goal, limit
 * Caches results to avoid duplicate calls within 30 seconds
 */
export async function fetchUsageMetrics(
  client: AuthenticatedClient,
  options?: {
    start_date?: string
    end_date?: string
    provider?: string
    goal?: string
    limit?: number
    force?: boolean
  }
) {
  const now = Date.now()
  const CACHE_DURATION = 30_000 // 30 seconds

  // Skip if recently fetched (unless forced)
  if (!options?.force && usageMetricsStore.lastFetch && now - usageMetricsStore.lastFetch < CACHE_DURATION) {
    return
  }

  usageMetricsStore.loading = true
  usageMetricsStore.error = null

  try {
    const data = await client.run(getUsageMetricsConfig, {
      query: {
        start_date: options?.start_date,
        end_date: options?.end_date,
        provider: options?.provider,
        goal: options?.goal,
        limit: options?.limit,
      }
    })
    usageMetricsStore.metrics = data.recent as ApiUsageMetric[]
    usageMetricsStore.lastFetch = now
  } catch (error) {
    usageMetricsStore.error = error instanceof Error ? error.message : 'Failed to fetch usage metrics'
    console.error('Error fetching usage metrics:', error)
  } finally {
    usageMetricsStore.loading = false
  }
}

/**
 * Force refresh usage metrics from API
 */
export async function refreshUsageMetrics(
  client: AuthenticatedClient,
  options?: {
    start_date?: string
    end_date?: string
    provider?: string
    goal?: string
    limit?: number
  }
) {
  return fetchUsageMetrics(client, { ...options, force: true })
}
