import { z } from 'zod'
import { route } from '@adi-family/http'

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

const secretWithProjectSchema = secretSchema.extend({
  project_id: z.string()
})

export type SecretResponse = z.infer<typeof secretSchema>
export type SecretWithProjectResponse = z.infer<typeof secretWithProjectSchema>

export interface GitLabTokenValidationResponse {
  validated: boolean
  username?: string
  scopeValidation?: {
    validated: boolean
    message: string
  }
  error?: string
}

export interface JiraTokenValidationResponse {
  valid: boolean
  username?: string
  accountId?: string
  email?: string | null
  error?: string
}

export type GitLabRepositoryResponse = Record<string, unknown>

export const getSecretValueConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/:id/value', z.object({ id: z.string() })),
  response: {
    schema: z.object({
      value: z.string()
    })
  }
} as const

export const listSecretsConfig = {
  method: 'GET',
  route: route.static('/api/secrets'),
  response: {
    schema: z.array(secretWithProjectSchema)
  }
} as const

export const getSecretsByProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/by-project/:projectId', z.object({ projectId: z.string() })),
  response: {
    schema: z.array(secretSchema)
  }
} as const

export const getSecretConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/:id', z.object({ id: z.string() })),
  response: {
    schema: secretSchema
  }
} as const

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
