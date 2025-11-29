import { z } from 'zod'
import { route } from '@adi-family/http'

export const secretSchema = z.object({
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

export const secretWithProjectSchema = secretSchema.extend({
  project_id: z.string()
})

export const gitLabTokenValidationResponseSchema = z.object({
  validated: z.boolean(),
  username: z.string().optional(),
  scopeValidation: z.object({
    validated: z.boolean(),
    message: z.string()
  }).optional(),
  error: z.string().optional()
})

export const jiraTokenValidationResponseSchema = z.object({
  valid: z.boolean(),
  username: z.string().optional(),
  accountId: z.string().optional(),
  email: z.string().nullable().optional(),
  error: z.string().optional()
})

export const gitLabRepositoryResponseSchema = z.record(z.string(), z.unknown())

export type SecretResponse = z.infer<typeof secretSchema>
export type SecretWithProjectResponse = z.infer<typeof secretWithProjectSchema>
export type GitLabTokenValidationResponse = z.infer<typeof gitLabTokenValidationResponseSchema>
export type JiraTokenValidationResponse = z.infer<typeof jiraTokenValidationResponseSchema>
export type GitLabRepositoryResponse = z.infer<typeof gitLabRepositoryResponseSchema>

export const secretValueResponseSchema = z.object({
  value: z.string(),
  token_type: z.enum(['api', 'oauth', 'pat']).nullable()
})

export const getSecretValueConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/:id/value', z.object({ id: z.string() })),
  response: {
    schema: secretValueResponseSchema
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

export const createSecretBodySchema = z.object({
  project_id: z.string(),
  name: z.string(),
  value: z.string(),
  description: z.string().optional()
})

export const createSecretResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string()
})

export const createSecretConfig = {
  method: 'POST',
  route: route.static('/api/secrets'),
  body: {
    schema: createSecretBodySchema
  },
  response: {
    schema: createSecretResponseSchema
  }
} as const

export const validateGitLabRawTokenBodySchema = z.object({
  token: z.string(),
  hostname: z.string(),
  scopes: z.array(z.string())
})

export const validateGitLabRawTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-gitlab-raw-token'),
  body: {
    schema: validateGitLabRawTokenBodySchema
  },
  response: {
    schema: gitLabTokenValidationResponseSchema
  }
} as const

export const validateGitLabTokenBodySchema = z.object({
  secretId: z.string(),
  hostname: z.string(),
  scopes: z.array(z.string())
})

export const validateGitLabTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-gitlab-token'),
  body: {
    schema: validateGitLabTokenBodySchema
  },
  response: {
    schema: gitLabTokenValidationResponseSchema
  }
} as const

export const getGitLabRepositoriesBodySchema = z.object({
  secretId: z.string(),
  host: z.string(),
  search: z.string().optional(),
  perPage: z.number().optional()
})

export const getGitLabRepositoriesConfig = {
  method: 'POST',
  route: route.static('/api/secrets/gitlab-repositories'),
  body: {
    schema: getGitLabRepositoriesBodySchema
  },
  response: {
    schema: z.array(gitLabRepositoryResponseSchema)
  }
} as const

export const validateJiraRawTokenBodySchema = z.object({
  token: z.string(),
  email: z.string().optional(),
  hostname: z.string()
})

export const validateJiraRawTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-jira-raw-token'),
  body: {
    schema: validateJiraRawTokenBodySchema
  },
  response: {
    schema: jiraTokenValidationResponseSchema
  },
} as const

export const validateJiraTokenBodySchema = z.object({
  secretId: z.string(),
  hostname: z.string()
})

export const validateJiraTokenConfig = {
  method: 'POST',
  route: route.static('/api/secrets/validate-jira-token'),
  body: {
    schema: validateJiraTokenBodySchema
  },
  response: {
    schema: jiraTokenValidationResponseSchema
  },
} as const
