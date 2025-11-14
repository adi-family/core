import { z } from 'zod'
import { route } from '@adi-family/http'

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

export type GitLabOAuthAuthorizeResponse = z.infer<typeof gitlabOAuthAuthorizeResponseSchema>
export type GitLabOAuthExchangeResponse = z.infer<typeof gitlabOAuthExchangeResponseSchema>
export type GitLabOAuthRefreshResponse = z.infer<typeof gitlabOAuthRefreshResponseSchema>

export const gitlabOAuthAuthorizeConfig = {
  method: 'GET',
  route: route.static('/api/oauth/gitlab/authorize'),
  response: {
    schema: gitlabOAuthAuthorizeResponseSchema
  }
} as const

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

export type JiraOAuthAuthorizeResponse = z.infer<typeof jiraOAuthAuthorizeResponseSchema>
export type JiraOAuthExchangeResponse = z.infer<typeof jiraOAuthExchangeResponseSchema>
export type JiraOAuthRefreshResponse = z.infer<typeof jiraOAuthRefreshResponseSchema>

export const jiraOAuthAuthorizeConfig = {
  method: 'GET',
  route: route.static('/api/oauth/jira/authorize'),
  response: {
    schema: jiraOAuthAuthorizeResponseSchema
  }
} as const

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

export const jiraOAuthRefreshConfig = {
  method: 'POST',
  route: route.dynamic('/api/oauth/jira/refresh/:secretId', z.object({ secretId: z.string() })),
  response: {
    schema: jiraOAuthRefreshResponseSchema
  }
} as const

const githubOAuthAuthorizeResponseSchema = z.object({
  authUrl: z.string(),
  state: z.string()
})

const githubOAuthExchangeResponseSchema = z.object({
  success: z.boolean(),
  secretId: z.string(),
  user: z.object({
    login: z.string(),
    name: z.string().nullable()
  }),
  scopes: z.array(z.string())
})

export type GitHubOAuthAuthorizeResponse = z.infer<typeof githubOAuthAuthorizeResponseSchema>
export type GitHubOAuthExchangeResponse = z.infer<typeof githubOAuthExchangeResponseSchema>

export const githubOAuthAuthorizeConfig = {
  method: 'GET',
  route: route.static('/api/oauth/github/authorize'),
  response: {
    schema: githubOAuthAuthorizeResponseSchema
  }
} as const

export const githubOAuthExchangeConfig = {
  method: 'POST',
  route: route.static('/api/oauth/github/exchange'),
  body: {
    schema: z.object({
      projectId: z.string(),
      code: z.string(),
      secretName: z.string()
    })
  },
  response: {
    schema: githubOAuthExchangeResponseSchema
  }
} as const
