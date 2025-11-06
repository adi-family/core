/**
 * Secrets API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * Secret schema (without encrypted value)
 */
const secretSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  oauth_provider: z.string().nullable(),
  token_type: z.enum(['api', 'oauth']).nullable(),
  expires_at: z.string().nullable(),
  scopes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

/**
 * Secret schema with project_id
 */
const secretWithProjectSchema = secretSchema.extend({
  project_id: z.string()
})

/**
 * Secret response types (inferred from schemas)
 */
export type SecretResponse = z.infer<typeof secretSchema>
export type SecretWithProjectResponse = z.infer<typeof secretWithProjectSchema>

/**
 * Secret validation response types
 */
export type GitLabTokenValidationResponse = {
  validated: boolean
  username?: string
  scopeValidation?: {
    validated: boolean
    message: string
  }
  error?: string
}

export type JiraTokenValidationResponse = {
  valid: boolean
  username?: string
  accountId?: string
  email?: string | null
  error?: string
}

/**
 * GitLab repository item (from GitLab API)
 */
export type GitLabRepositoryResponse = Record<string, unknown>

/**
 * Get decrypted secret value by ID
 * GET /api/secrets/:id/value
 */
export const getSecretValueConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/:id/value', z.object({ id: z.string() })),
  response: {
    schema: z.object({
      value: z.string()
    })
  }
} as const

/**
 * List all secrets
 * GET /api/secrets
 */
export const listSecretsConfig = {
  method: 'GET',
  route: route.static('/api/secrets'),
  response: {
    schema: z.array(secretWithProjectSchema)
  }
} as const

/**
 * Get secrets by project ID
 * GET /api/secrets/by-project/:projectId
 */
export const getSecretsByProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/by-project/:projectId', z.object({ projectId: z.string() })),
  response: {
    schema: z.array(secretSchema)
  }
} as const

/**
 * Get secret by ID
 * GET /api/secrets/:id
 */
export const getSecretConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/:id', z.object({ id: z.string() })),
  response: {
    schema: secretSchema
  }
} as const

/**
 * Create secret
 * POST /api/secrets
 */
export const createSecretConfig = {
  method: 'POST',
  route: route.static('/api/secrets'),
  body: {
    schema: z.object({
      project_id: z.string(),
      name: z.string(),
      value: z.string(),
      description: z.string().optional()
    })
  },
  response: {
    schema: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      created_at: z.string()
    })
  }
} as const

/**
 * Validate GitLab raw token
 * POST /api/secrets/validate-gitlab-raw-token
 */
export const validateGitLabRawTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-gitlab-raw-token'),
  body: {
    schema: z.object({
      token: z.string(),
      hostname: z.string(),
      scopes: z.array(z.string())
    })
  },
  response: {
    schema: z.object({
      validated: z.boolean(),
      username: z.string().optional(),
      scopeValidation: z.object({
        validated: z.boolean(),
        message: z.string()
      }).optional(),
      error: z.string().optional()
    })
  }
} as const

/**
 * Validate GitLab token by secret ID
 * POST /api/secrets/validate-gitlab-token
 */
export const validateGitLabTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-gitlab-token'),
  body: {
    schema: z.object({
      secretId: z.string(),
      hostname: z.string(),
      scopes: z.array(z.string())
    })
  },
  response: {
    schema: z.object({
      validated: z.boolean(),
      username: z.string().optional(),
      scopeValidation: z.object({
        validated: z.boolean(),
        message: z.string()
      }).optional(),
      error: z.string().optional()
    })
  }
} as const

/**
 * Get GitLab repositories using a secret
 * POST /api/secrets/gitlab-repositories
 */
export const getGitLabRepositoriesConfig = {
  method: 'POST',
  route: route.static('/api/secrets/gitlab-repositories'),
  body: {
    schema: z.object({
      secretId: z.string(),
      host: z.string(),
      search: z.string().optional(),
      perPage: z.number().optional()
    })
  },
  response: {
    schema: z.array(z.record(z.string(), z.unknown()))
  }
} as const

/**
 * Validate Jira raw token
 * POST /api/secrets/validate-jira-raw-token
 */
export const validateJiraRawTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-jira-raw-token'),
  body: {
    schema: z.object({
      token: z.string(),
      email: z.string().optional(),
      hostname: z.string()
    })
  },
  response: {
    schema: z.object({
      valid: z.boolean(),
      username: z.string().optional(),
      accountId: z.string().optional(),
      email: z.string().nullable().optional(),
      error: z.string().optional()
    }),
  },
} as const

/**
 * Validate Jira token by secret ID
 * POST /api/secrets/validate-jira-token
 */
export const validateJiraTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-jira-token'),
  body: {
    schema: z.object({
      secretId: z.string(),
      hostname: z.string()
    })
  },
  response: {
    schema: z.object({
      valid: z.boolean(),
      username: z.string().optional(),
      accountId: z.string().optional(),
      email: z.string().nullable().optional(),
      error: z.string().optional()
    }),
  },
} as const
