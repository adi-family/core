/**
 * OAuth API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * Response schemas
 */
const gitlabOAuthAuthorizeResponseSchema = z.object({
  authUrl: z.string(),
  state: z.string()
})

const gitlabOAuthExchangeResponseSchema = z.object({
  success: z.boolean(),
  secretId: z.string(),
  expiresAt: z.string(),
  user: z.object({
    username: z.string(),
    name: z.string(),
    email: z.string()
  })
})

const gitlabOAuthRefreshResponseSchema = z.object({
  success: z.boolean(),
  expiresAt: z.string()
})

/**
 * Exported response types (inferred from schemas)
 */
export type GitLabOAuthAuthorizeResponse = z.infer<typeof gitlabOAuthAuthorizeResponseSchema>
export type GitLabOAuthExchangeResponse = z.infer<typeof gitlabOAuthExchangeResponseSchema>
export type GitLabOAuthRefreshResponse = z.infer<typeof gitlabOAuthRefreshResponseSchema>

/**
 * Initiate GitLab OAuth flow
 * GET /api/oauth/gitlab/authorize
 */
export const gitlabOAuthAuthorizeConfig = {
  method: 'GET',
  route: route.static('/api/oauth/gitlab/authorize'),
  response: {
    schema: gitlabOAuthAuthorizeResponseSchema
  }
} as const

/**
 * Exchange GitLab authorization code for tokens
 * POST /api/oauth/gitlab/exchange
 */
export const gitlabOAuthExchangeConfig = {
  method: 'POST',
  route: route.static('/api/oauth/gitlab/exchange'),
  body: {
    schema: z.object({
      projectId: z.string(),
      code: z.string(),
      secretName: z.string(),
      gitlabHost: z.string().optional()
    })
  },
  response: {
    schema: gitlabOAuthExchangeResponseSchema
  }
} as const

/**
 * Refresh GitLab OAuth token
 * POST /api/oauth/gitlab/refresh/:secretId
 */
export const gitlabOAuthRefreshConfig = {
  method: 'POST',
  route: route.dynamic('/api/oauth/gitlab/refresh/:secretId', z.object({ secretId: z.string() })),
  response: {
    schema: gitlabOAuthRefreshResponseSchema
  }
} as const

/**
 * Jira OAuth schemas
 */
const jiraOAuthAuthorizeResponseSchema = z.object({
  authUrl: z.string(),
  state: z.string()
})

const jiraOAuthExchangeResponseSchema = z.object({
  success: z.boolean(),
  secretId: z.string(),
  expiresAt: z.string(),
  sites: z.array(z.object({
    id: z.string(),
    url: z.string(),
    name: z.string(),
    scopes: z.array(z.string())
  }))
})

const jiraOAuthRefreshResponseSchema = z.object({
  success: z.boolean(),
  expiresAt: z.string()
})

/**
 * Exported Jira response types (inferred from schemas)
 */
export type JiraOAuthAuthorizeResponse = z.infer<typeof jiraOAuthAuthorizeResponseSchema>
export type JiraOAuthExchangeResponse = z.infer<typeof jiraOAuthExchangeResponseSchema>
export type JiraOAuthRefreshResponse = z.infer<typeof jiraOAuthRefreshResponseSchema>

/**
 * Initiate Jira OAuth flow
 * GET /api/oauth/jira/authorize
 */
export const jiraOAuthAuthorizeConfig = {
  method: 'GET',
  route: route.static('/api/oauth/jira/authorize'),
  query: {
    schema: z.object({
      client_id: z.string(),
      redirect_uri: z.string(),
      scopes: z.string().optional()
    })
  },
  response: {
    schema: jiraOAuthAuthorizeResponseSchema
  }
} as const

/**
 * Exchange Jira authorization code for tokens
 * POST /api/oauth/jira/exchange
 */
export const jiraOAuthExchangeConfig = {
  method: 'POST',
  route: route.static('/api/oauth/jira/exchange'),
  body: {
    schema: z.object({
      projectId: z.string(),
      code: z.string(),
      secretName: z.string(),
      cloudId: z.string().optional()
    })
  },
  response: {
    schema: jiraOAuthExchangeResponseSchema
  }
} as const

/**
 * Refresh Jira OAuth token
 * POST /api/oauth/jira/refresh/:secretId
 */
export const jiraOAuthRefreshConfig = {
  method: 'POST',
  route: route.dynamic('/api/oauth/jira/refresh/:secretId', z.object({ secretId: z.string() })),
  response: {
    schema: jiraOAuthRefreshResponseSchema
  }
} as const
