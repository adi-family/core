import { route } from '@adi-family/http'
import { z } from 'zod'

export const getUsageMetricsConfig = {
  method: 'GET',
  route: route.static('/api/admin/usage-metrics'),
  query: {
    schema: z.object({
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      provider: z.string().optional(),
      goal: z.string().optional(),
      limit: z.coerce.number().optional(),
    }).optional()
  },
  response: {
    schema: z.object({
      recent: z.array(z.object({
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
        created_at: z.date().or(z.string())
      })),
      aggregated: z.array(z.object({
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
      })).optional(),
    })
  }
} as const

export const getWorkerReposConfig = {
  method: 'GET',
  route: route.static('/api/admin/worker-repos'),
  response: {
    schema: z.object({
      repositories: z.array(z.object({
        id: z.string(),
        project_id: z.string(),
        project_name: z.string(),
        current_version: z.string(),
        gitlab_path: z.string(),
        gitlab_host: z.string(),
        updated_at: z.string().or(z.date())
      }))
    })
  }
} as const

export const refreshWorkerReposConfig = {
  method: 'POST',
  route: route.static('/api/admin/refresh-worker-repos'),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string(),
      results: z.array(z.object({
        project: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
        filesUpdated: z.number().optional(),
        fileErrors: z.array(z.object({
          file: z.string(),
          error: z.string()
        })).optional()
      })),
      summary: z.object({
        total: z.number(),
        succeeded: z.number(),
        failed: z.number()
      })
    })
  }
} as const

export const executeAdminOperationConfig = {
  method: 'POST',
  route: route.dynamic('/api/admin/operations/:operation', z.object({ operation: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string(),
      data: z.any().optional()
    })
  }
} as const
