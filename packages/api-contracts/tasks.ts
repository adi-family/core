/**
 * Task API Contracts
 */

import { z } from 'zod'
import { route, type HandlerConfig } from '@adi-family/http'

// Session schema - matches database type
const sessionSchema = z.any()  // Temporarily use any for rapid conversion

// Artifact schema - matches database type
const artifactSchema = z.any()  // Temporarily use any for rapid conversion

/**
 * Get sessions by task ID
 * GET /tasks/:taskId/sessions
 */
export const getTaskSessionsConfig = {
  method: 'GET',
  route: route.dynamic('/tasks/:taskId/sessions', z.object({ taskId: z.string() })),
  response: {
    schema: z.array(sessionSchema)
  }
} as const satisfies HandlerConfig

/**
 * Get artifacts by task ID
 * GET /tasks/:taskId/artifacts
 */
export const getTaskArtifactsConfig = {
  method: 'GET',
  route: route.dynamic('/tasks/:taskId/artifacts', z.object({ taskId: z.string() })),
  response: {
    schema: z.array(artifactSchema)
  }
} as const satisfies HandlerConfig

/**
 * Get task by ID
 * GET /api/tasks/:id
 */
export const getTaskConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/:id', z.object({ id: z.string() })),
  response: {
    schema: z.any()  // Temporarily use any for rapid conversion
  }
} as const satisfies HandlerConfig
