/**
 * OAuth API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * Initiate GitLab OAuth flow
 * GET /api/oauth/gitlab/authorize
 */
export const gitlabOAuthAuthorizeConfig = {
  method: 'GET',
  route: route.static('/api/oauth/gitlab/authorize'),
  response: {
    schema: z.object({
      authUrl: z.string(),
      state: z.string()
    })
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
    schema: z.any()
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
    schema: z.object({
      success: z.boolean(),
      expiresAt: z.string()
    })
  }
} as const

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
    schema: z.object({
      authUrl: z.string(),
      state: z.string()
    })
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
    schema: z.any()
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
    schema: z.object({
      success: z.boolean(),
      expiresAt: z.string()
    })
  }
} as const
