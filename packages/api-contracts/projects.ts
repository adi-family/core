/**
 * Project API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

// AI Provider Config Schemas
const anthropicCloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

const anthropicSelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

const anthropicConfigSchema = z.union([anthropicCloudConfigSchema, anthropicSelfHostedConfigSchema])

const openAICloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string(),
  organization_id: z.string().optional(),
  model: z.string().optional()
})

const openAIAzureConfigSchema = z.object({
  type: z.literal('azure'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  deployment_name: z.string(),
  api_version: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

const openAISelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

const openAIConfigSchema = z.union([openAICloudConfigSchema, openAIAzureConfigSchema, openAISelfHostedConfigSchema])

const googleCloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

const googleVertexConfigSchema = z.object({
  type: z.literal('vertex'),
  api_key_secret_id: z.string(),
  project_id: z.string(),
  location: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

const googleSelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

const googleConfigSchema = z.union([googleCloudConfigSchema, googleVertexConfigSchema, googleSelfHostedConfigSchema])

const aiProviderConfigSchema = z.object({
  anthropic: anthropicConfigSchema.optional(),
  openai: openAIConfigSchema.optional(),
  google: googleConfigSchema.optional()
})

const gitlabExecutorConfigSchema = z.object({
  host: z.string(),
  access_token_secret_id: z.string(),
  verified_at: z.string().optional(),
  user: z.string().optional()
})

/**
 * Exported response types (inferred from schemas)
 */
export type ProjectResponse = z.infer<typeof projectSchema>
export type AIProviderConfigResponse = z.infer<typeof aiProviderConfigSchema>
export type GitLabExecutorConfigResponse = z.infer<typeof gitlabExecutorConfigSchema>
export type AIProviderValidationResponse = {
  valid: boolean
  endpoint_reachable: boolean
  authentication_valid: boolean
  error?: string
  details?: Record<string, unknown>
  tested_at: string
}

// Schemas
const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  job_executor_gitlab: gitlabExecutorConfigSchema.nullable(),
  ai_provider_configs: aiProviderConfigSchema.nullable(),
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
    schema: aiProviderConfigSchema.nullable()
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
    schema: z.union([anthropicConfigSchema, openAIConfigSchema, googleConfigSchema])
  },
  response: {
    schema: aiProviderConfigSchema
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
    schema: z.union([anthropicConfigSchema, openAIConfigSchema, googleConfigSchema])
  },
  response: {
    schema: z.object({
      valid: z.boolean(),
      endpoint_reachable: z.boolean(),
      authentication_valid: z.boolean(),
      error: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
      tested_at: z.string()
    })
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
    schema: gitlabExecutorConfigSchema.nullable()
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
    schema: gitlabExecutorConfigSchema
  },
  response: {
    schema: gitlabExecutorConfigSchema
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
