/**
 * Pipeline Execution API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

export const pipelineArtifactTypeSchema = z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation'])

export const artifactSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string(),
  artifact_type: pipelineArtifactTypeSchema,
  reference_url: z.string(),
  metadata: z.unknown().nullable(),
  created_at: z.string().or(z.date())
})

export const pipelineStatusSchema = z.enum(['pending', 'running', 'success', 'failed', 'canceled'])

export const pipelineExecutionSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  worker_repository_id: z.string(),
  pipeline_id: z.string(),
  status: pipelineStatusSchema,
  last_status_update: z.string().nullable(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date())
})

export const listPipelineExecutionsQuerySchema = z.object({
  session_id: z.string().optional(),
  worker_repository_id: z.string().optional()
})

export const listPipelineExecutionsConfig = {
  method: 'GET',
  route: route.static('/api/pipeline-executions'),
  query: {
    schema: listPipelineExecutionsQuerySchema.optional()
  },
  response: {
    schema: z.array(pipelineExecutionSchema)
  }
} as const

export const listPipelineArtifactsQuerySchema = z.object({
  execution_id: z.string().optional()
})

export const listPipelineArtifactsConfig = {
  method: 'GET',
  route: route.static('/api/pipeline-artifacts'),
  query: {
    schema: listPipelineArtifactsQuerySchema.optional()
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

export const createExecutionArtifactBodySchema = z.object({
  artifact_type: pipelineArtifactTypeSchema,
  reference_url: z.string(),
  metadata: z.unknown().optional()
})

export const createExecutionArtifactConfig = {
  method: 'POST',
  route: route.dynamic('/pipeline-executions/:executionId/artifacts', z.object({ executionId: z.string() })),
  body: {
    schema: createExecutionArtifactBodySchema
  },
  response: {
    schema: artifactSchema
  }
} as const

export const createPipelineExecutionBodySchema = z.object({
  session_id: z.string(),
  worker_repository_id: z.string(),
  pipeline_id: z.string().optional(),
  status: pipelineStatusSchema
})

export const createPipelineExecutionConfig = {
  method: 'POST',
  route: route.static('/api/pipeline-executions'),
  body: {
    schema: createPipelineExecutionBodySchema
  },
  response: {
    schema: pipelineExecutionSchema
  }
} as const

export const updatePipelineExecutionBodySchema = z.object({
  pipeline_id: z.string().optional(),
  status: pipelineStatusSchema.optional(),
  last_status_update: z.string().optional()
})

export const updatePipelineExecutionConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/pipeline-executions/:id', z.object({ id: z.string() })),
  body: {
    schema: updatePipelineExecutionBodySchema
  },
  response: {
    schema: pipelineExecutionSchema
  }
} as const

export const saveExecutionApiUsageBodySchema = z.object({
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
  metadata: z.unknown().optional()
})

export const saveExecutionApiUsageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional()
})

export const saveExecutionApiUsageConfig = {
  method: 'POST',
  route: route.dynamic('/pipeline-executions/:executionId/usage', z.object({ executionId: z.string() })),
  body: {
    schema: saveExecutionApiUsageBodySchema
  },
  response: {
    schema: saveExecutionApiUsageResponseSchema
  }
} as const
