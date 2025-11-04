/**
 * Task API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

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
} as const

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
} as const

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
} as const

/**
 * List all tasks
 * GET /api/tasks
 */
export const listTasksConfig = {
  method: 'GET',
  route: route.static('/api/tasks'),
  query: {
    schema: z.object({
      project_id: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    }).optional()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Implement task
 * POST /api/tasks/:id/implement
 */
export const implementTaskConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/implement', z.object({ id: z.string() })),
  body: {
    schema: z.any()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Evaluate task
 * POST /api/tasks/:id/evaluate
 */
export const evaluateTaskConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/evaluate', z.object({ id: z.string() })),
  body: {
    schema: z.any()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Get tasks by task source ID
 * GET /api/tasks/by-task-source/:taskSourceId
 */
export const getTasksByTaskSourceConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/by-task-source/:taskSourceId', z.object({ taskSourceId: z.string() })),
  response: {
    schema: z.any()
  }
} as const

/**
 * Get tasks by project ID
 * GET /api/tasks/by-project/:projectId
 */
export const getTasksByProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/by-project/:projectId', z.object({ projectId: z.string() })),
  response: {
    schema: z.any()
  }
} as const
