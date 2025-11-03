/**
 * Project API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

// Schemas
const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  job_executor_gitlab: z.any().nullable(),
  ai_provider_configs: z.any().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_synced_at: z.string().nullable()
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
} as const

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
} as const

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
} as const

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
} as const

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
} as const

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
} as const

/**
 * Get AI providers for project
 * GET /api/projects/:id/ai-providers
 */
export const getProjectAIProvidersConfig = {
  method: 'GET',
  route: route.dynamic('/api/projects/:id/ai-providers', z.object({ id: z.string() })),
  response: {
    schema: z.any()
  }
} as const

/**
 * Update AI provider configuration
 * PUT /api/projects/:id/ai-providers/:provider
 */
export const updateProjectAIProviderConfig = {
  method: 'PUT',
  route: route.dynamic('/api/projects/:id/ai-providers/:provider', z.object({
    id: z.string(),
    provider: z.string()
  })),
  body: {
    schema: z.any()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Delete AI provider configuration
 * DELETE /api/projects/:id/ai-providers/:provider
 */
export const deleteProjectAIProviderConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/projects/:id/ai-providers/:provider', z.object({
    id: z.string(),
    provider: z.string()
  })),
  response: {
    schema: z.object({ success: z.boolean() })
  }
} as const

/**
 * Validate AI provider configuration
 * POST /api/projects/:id/ai-providers/:provider/validate
 */
export const validateProjectAIProviderConfig = {
  method: 'POST',
  route: route.dynamic('/api/projects/:id/ai-providers/:provider/validate', z.object({
    id: z.string(),
    provider: z.string()
  })),
  body: {
    schema: z.any()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Get GitLab job executor configuration
 * GET /api/projects/:id/job-executor-gitlab
 */
export const getProjectGitLabExecutorConfig = {
  method: 'GET',
  route: route.dynamic('/api/projects/:id/job-executor-gitlab', z.object({ id: z.string() })),
  response: {
    schema: z.any()
  }
} as const

/**
 * Create/Update GitLab job executor configuration
 * POST /api/projects/:id/job-executor-gitlab
 */
export const createProjectGitLabExecutorConfig = {
  method: 'POST',
  route: route.dynamic('/api/projects/:id/job-executor-gitlab', z.object({ id: z.string() })),
  body: {
    schema: z.any()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Delete GitLab job executor configuration
 * DELETE /api/projects/:id/job-executor-gitlab
 */
export const deleteProjectGitLabExecutorConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/projects/:id/job-executor-gitlab', z.object({ id: z.string() })),
  response: {
    schema: z.object({ success: z.boolean() })
  }
} as const
