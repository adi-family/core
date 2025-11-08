/**
 * Pipeline Execution API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

const artifactSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string(),
  artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation']),
  reference_url: z.string(),
  metadata: z.any().nullable(),
  created_at: z.string().or(z.date())
})

export const listPipelineExecutionsConfig = {
  method: 'GET',
  route: route.static('/api/pipeline-executions'),
  query: {
    schema: z.object({
      session_id: z.string().optional(),
      worker_repository_id: z.string().optional()
    }).optional()
  },
  response: {
    schema: z.array(z.object({
      id: z.string(),
      session_id: z.string(),
      worker_repository_id: z.string(),
      pipeline_id: z.string(),
      status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']),
      last_status_update: z.string().nullable(),
      created_at: z.string().or(z.date()),
      updated_at: z.string().or(z.date())
    }))
  }
} as const

export const listPipelineArtifactsConfig = {
  method: 'GET',
  route: route.static('/api/pipeline-artifacts'),
  query: {
    schema: z.object({
      execution_id: z.string().optional()
    }).optional()
  },
  response: {
    schema: z.array(artifactSchema)
  }
} as const

export const getExecutionArtifactsConfig = {
  method: 'GET',
  route: route.dynamic('/pipeline-executions/:executionId/artifacts', z.object({ executionId: z.string() })),
  response: {
    schema: z.array(artifactSchema)
  }
} as const

export const createExecutionArtifactConfig = {
  method: 'POST',
  route: route.dynamic('/pipeline-executions/:executionId/artifacts', z.object({ executionId: z.string() })),
  body: {
    schema: z.object({
      artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation']),
      reference_url: z.string(),
      metadata: z.any().optional()
    })
  },
  response: {
    schema: artifactSchema
  }
} as const

export const createPipelineExecutionConfig = {
  method: 'POST',
  route: route.static('/api/pipeline-executions'),
  body: {
    schema: z.object({
      session_id: z.string(),
      worker_repository_id: z.string(),
      pipeline_id: z.string().optional(),
      status: z.enum(['pending', 'running', 'success', 'failed', 'canceled'])
    })
  },
  response: {
    schema: z.object({
      id: z.string(),
      session_id: z.string(),
      worker_repository_id: z.string(),
      pipeline_id: z.string(),
      status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']),
      last_status_update: z.string().nullable(),
      created_at: z.string().or(z.date()),
      updated_at: z.string().or(z.date())
    })
  }
} as const

export const updatePipelineExecutionConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/pipeline-executions/:id', z.object({ id: z.string() })),
  body: {
    schema: z.object({
      pipeline_id: z.string().optional(),
      status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']).optional(),
      last_status_update: z.string().optional()
    })
  },
  response: {
    schema: z.object({
      id: z.string(),
      session_id: z.string(),
      worker_repository_id: z.string(),
      pipeline_id: z.string(),
      status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']),
      last_status_update: z.string().nullable(),
      created_at: z.string().or(z.date()),
      updated_at: z.string().or(z.date())
    })
  }
} as const

export const saveExecutionApiUsageConfig = {
  method: 'POST',
  route: route.dynamic('/pipeline-executions/:executionId/usage', z.object({ executionId: z.string() })),
  body: {
    schema: z.object({
      session_id: z.string(),
      task_id: z.string(),
      provider: z.string(),
      model: z.string(),
      goal: z.string(),
      phase: z.string(),
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
      ci_duration_seconds: z.number().optional(),
      iteration_number: z.number().optional(),
      metadata: z.any().optional()
    })
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string().optional()
    })
  }
} as const
