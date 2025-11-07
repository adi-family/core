import { z } from 'zod'
import { proxy } from 'valtio'
import { getUsageMetricsConfig } from '@adi/api-contracts'
import type { BaseClient } from '@adi-family/http'

const apiUsageMetricSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string().nullable(),
  session_id: z.string().nullable(),
  task_id: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  goal: z.string(),
  operation_phase: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number(),
  cache_read_input_tokens: z.number(),
  ci_duration_seconds: z.number().nullable(),
  iteration_number: z.number().nullable(),
  metadata: z.any().nullable(),
  created_at: z.union([z.date(), z.string()])
})

export type ApiUsageMetric = z.infer<typeof apiUsageMetricSchema>

const _usageMetricsStoreSchema = z.object({
  metrics: z.array(apiUsageMetricSchema),
  loading: z.boolean(),
  error: z.string().nullable(),
  lastFetch: z.number().nullable()
})

type UsageMetricsStore = z.infer<typeof _usageMetricsStoreSchema>

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
  client: BaseClient,
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
  client: BaseClient,
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
