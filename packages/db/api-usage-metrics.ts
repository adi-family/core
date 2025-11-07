import type { MaybeRow, PendingQuery, Sql } from 'postgres'
import type {
  ApiUsageMetric,
  CreateApiUsageMetricInput,
  AggregatedUsageMetric,
  UsageMetricsFilters
} from '@types'

// Re-export types for backward compatibility
export type {
  ApiUsageMetric,
  CreateApiUsageMetricInput,
  AggregatedUsageMetric,
  UsageMetricsFilters
}

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v)
}

export const createApiUsageMetric = async (
  sql: Sql,
  input: CreateApiUsageMetricInput
): Promise<ApiUsageMetric> => {
  const [metric] = await get(sql<ApiUsageMetric[]>`
    INSERT INTO api_usage_metrics (
      pipeline_execution_id,
      session_id,
      task_id,
      provider,
      model,
      goal,
      operation_phase,
      input_tokens,
      output_tokens,
      cache_creation_input_tokens,
      cache_read_input_tokens,
      ci_duration_seconds,
      iteration_number,
      metadata
    ) VALUES (
      ${input.pipeline_execution_id ?? null},
      ${input.session_id ?? null},
      ${input.task_id ?? null},
      ${input.provider},
      ${input.model},
      ${input.goal},
      ${input.phase},
      ${input.input_tokens},
      ${input.output_tokens},
      ${input.cache_creation_input_tokens},
      ${input.cache_read_input_tokens},
      ${input.ci_duration_seconds ?? null},
      ${input.iteration_number ?? null},
      ${input.metadata ? sql.json(input.metadata) : null}
    )
    RETURNING *
  `)
  if (!metric) {
    throw new Error('Failed to create API usage metric')
  }
  return metric
}

export const findAggregatedUsageMetrics = async (
  sql: Sql,
  filters: UsageMetricsFilters
): Promise<AggregatedUsageMetric[]> => {
  let whereClause = sql`WHERE 1=1`

  if (filters.start_date) {
    whereClause = sql`${whereClause} AND created_at >= ${filters.start_date}`
  }

  if (filters.end_date) {
    whereClause = sql`${whereClause} AND created_at <= ${filters.end_date}`
  }

  if (filters.provider) {
    whereClause = sql`${whereClause} AND provider = ${filters.provider}`
  }

  if (filters.goal) {
    whereClause = sql`${whereClause} AND goal = ${filters.goal}`
  }

  return get(sql<AggregatedUsageMetric[]>`
    SELECT
      provider,
      goal,
      operation_phase,
      DATE(created_at) as date,
      SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_input_tokens) as cache_creation_tokens,
      SUM(cache_read_input_tokens) as cache_read_tokens,
      SUM(ci_duration_seconds) as total_ci_duration,
      COUNT(*) as api_calls
    FROM api_usage_metrics
    ${whereClause}
    GROUP BY provider, goal, operation_phase, DATE(created_at)
    ORDER BY date DESC, provider, goal
  `)
}

export const findRecentUsageMetrics = async (
  sql: Sql,
  filters: UsageMetricsFilters,
  limit = 100
): Promise<ApiUsageMetric[]> => {
  let whereClause = sql`WHERE 1=1`

  if (filters.start_date) {
    whereClause = sql`${whereClause} AND created_at >= ${filters.start_date}`
  }

  if (filters.end_date) {
    whereClause = sql`${whereClause} AND created_at <= ${filters.end_date}`
  }

  if (filters.provider) {
    whereClause = sql`${whereClause} AND provider = ${filters.provider}`
  }

  if (filters.goal) {
    whereClause = sql`${whereClause} AND goal = ${filters.goal}`
  }

  return get(sql<ApiUsageMetric[]>`
    SELECT
      id,
      session_id,
      task_id,
      provider,
      model,
      goal,
      operation_phase,
      input_tokens,
      output_tokens,
      cache_creation_input_tokens,
      cache_read_input_tokens,
      ci_duration_seconds,
      iteration_number,
      created_at
    FROM api_usage_metrics
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `)
}
