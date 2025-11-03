/**
 * Pipeline Execution API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

// Artifact schema - matches database type
const artifactSchema = z.any()  // Temporarily use any for rapid conversion

/**
 * Get artifacts by execution ID
 * GET /pipeline-executions/:executionId/artifacts
 */
export const getExecutionArtifactsConfig = {
  method: 'GET',
  route: route.dynamic('/pipeline-executions/:executionId/artifacts', z.object({ executionId: z.string() })),
  response: {
    schema: z.array(artifactSchema)
  }
} as const

/**
 * Create artifact for execution
 * POST /pipeline-executions/:executionId/artifacts
 */
export const createExecutionArtifactConfig = {
  method: 'POST',
  route: route.dynamic('/pipeline-executions/:executionId/artifacts', z.object({ executionId: z.string() })),
  body: {
    schema: z.any()  // Temporarily use any for rapid conversion
  },
  response: {
    schema: artifactSchema
  }
} as const

/**
 * Create pipeline execution
 * POST /api/pipeline-executions
 */
export const createPipelineExecutionConfig = {
  method: 'POST',
  route: route.static('/api/pipeline-executions'),
  body: {
    schema: z.object({
      session_id: z.string(),
      worker_repository_id: z.string(),
      status: z.enum(['pending', 'running', 'success', 'failed', 'cancelled'])
    })
  },
  response: {
    schema: z.any()  // Temporarily use any for rapid conversion
  }
} as const

/**
 * Update pipeline execution
 * PATCH /api/pipeline-executions/:id
 */
export const updatePipelineExecutionConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/pipeline-executions/:id', z.object({ id: z.string() })),
  body: {
    schema: z.any()  // Temporarily use any for rapid conversion
  },
  response: {
    schema: z.any()  // Temporarily use any for rapid conversion
  }
} as const
