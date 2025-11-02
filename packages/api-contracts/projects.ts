/**
 * Project API Contracts
 */

import { z } from 'zod'
import { route, type HandlerConfig } from '@adi-family/http'

// Schemas
const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
})

/**
 * List all projects
 * GET /api/projects
 */
export const listProjectsConfig = {
  method: 'GET',
  route: route.static('/api/projects'),
  response: {
    schema: z.array(projectSchema)
  }
} as const satisfies HandlerConfig

/**
 * Get project by ID
 * GET /api/projects/:id
 */
export const getProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/projects/:id', z.object({ id: z.string() })),
  response: {
    schema: projectSchema
  }
} as const satisfies HandlerConfig

/**
 * Create new project
 * POST /api/projects
 */
export const createProjectConfig = {
  method: 'POST',
  route: route.static('/api/projects'),
  body: {
    schema: z.object({
      name: z.string(),
      enabled: z.boolean().optional()
    })
  },
  response: {
    schema: projectSchema
  }
} as const satisfies HandlerConfig

/**
 * Update project
 * PATCH /api/projects/:id
 */
export const updateProjectConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/projects/:id', z.object({ id: z.string() })),
  body: {
    schema: z.object({
      name: z.string().optional(),
      enabled: z.boolean().optional()
    })
  },
  response: {
    schema: projectSchema
  }
} as const satisfies HandlerConfig

/**
 * Delete project
 * DELETE /api/projects/:id
 */
export const deleteProjectConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/projects/:id', z.object({ id: z.string() })),
  response: {
    schema: z.object({ success: z.boolean() })
  }
} as const satisfies HandlerConfig

/**
 * Get project stats
 * GET /api/projects/:id/stats
 */
export const getProjectStatsConfig = {
  method: 'GET',
  route: route.dynamic('/api/projects/:id/stats', z.object({ id: z.string() })),
  response: {
    schema: z.object({
      total_tasks: z.number(),
      completed_tasks: z.number(),
      pending_tasks: z.number()
    })
  }
} as const satisfies HandlerConfig
