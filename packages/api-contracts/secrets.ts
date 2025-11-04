/**
 * Secrets API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

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
    schema: z.any()
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
    schema: z.any()
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
    schema: z.any()
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
    schema: z.any()
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
    schema: z.any()
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
    schema: z.any()
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
    schema: z.any()
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
    schema: z.any()
  }
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
    schema: z.any()
  }
} as const
