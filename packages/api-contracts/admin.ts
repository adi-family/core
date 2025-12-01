import { route } from '@adi-family/http'
import { z } from 'zod'

export const usageMetricsQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  provider: z.string().optional(),
  goal: z.string().optional(),
  limit: z.coerce.number().optional(),
})

export const usageMetricItemSchema = z.object({
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
  metadata: z.unknown().nullable(),
  created_at: z.date().or(z.string())
})

export const aggregatedUsageMetricSchema = z.object({
  provider: z.string(),
  goal: z.string(),
  operation_phase: z.string(),
  date: z.date().or(z.string()),
  total_tokens: z.string(),
  input_tokens: z.string(),
  output_tokens: z.string(),
  cache_creation_tokens: z.string(),
  cache_read_tokens: z.string(),
  total_ci_duration: z.string(),
  api_calls: z.string()
})

export const usageMetricsResponseSchema = z.object({
  recent: z.array(usageMetricItemSchema),
  aggregated: z.array(aggregatedUsageMetricSchema).optional(),
})

export const getUsageMetricsConfig = {
  method: 'GET',
  route: route.static('/api/admin/usage-metrics'),
  query: {
    schema: usageMetricsQuerySchema.optional()
  },
  response: {
    schema: usageMetricsResponseSchema
  }
} as const

export const workerRepoItemSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  project_name: z.string(),
  current_version: z.string(),
  gitlab_path: z.string(),
  gitlab_host: z.string(),
  updated_at: z.string().or(z.date())
})

export const workerReposResponseSchema = z.object({
  repositories: z.array(workerRepoItemSchema)
})

export const getWorkerReposConfig = {
  method: 'GET',
  route: route.static('/api/admin/worker-repos'),
  response: {
    schema: workerReposResponseSchema
  }
} as const

export const fileErrorSchema = z.object({
  file: z.string(),
  error: z.string()
})

export const refreshWorkerRepoResultSchema = z.object({
  project: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  filesUpdated: z.number().optional(),
  fileErrors: z.array(fileErrorSchema).optional()
})

export const refreshWorkerReposSummarySchema = z.object({
  total: z.number(),
  succeeded: z.number(),
  failed: z.number()
})

export const refreshWorkerReposResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  results: z.array(refreshWorkerRepoResultSchema),
  summary: refreshWorkerReposSummarySchema
})

export const refreshWorkerReposConfig = {
  method: 'POST',
  route: route.static('/api/admin/refresh-worker-repos'),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: refreshWorkerReposResponseSchema
  }
} as const

export const adminOperationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional()
})

export const executeAdminOperationConfig = {
  method: 'POST',
  route: route.dynamic('/api/admin/operations/:operation', z.object({ operation: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: adminOperationResponseSchema
  }
} as const
