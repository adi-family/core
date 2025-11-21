/**
 * OAuth handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler, type HandlerContext } from '@adi-family/http'
import {
  gitlabOAuthAuthorizeConfig,
  gitlabOAuthExchangeConfig,
  gitlabOAuthRefreshConfig,
  jiraOAuthAuthorizeConfig,
  jiraOAuthExchangeConfig,
  jiraOAuthRefreshConfig,
  githubOAuthAuthorizeConfig,
  githubOAuthExchangeConfig
} from '@adi/api-contracts'
import * as secretQueries from '@db/secrets'
import * as userAccessQueries from '@db/user-access'
import { createLogger } from '@utils/logger'
import { refreshGitLabToken, refreshJiraToken } from '@backend/services/oauth-token-refresh'
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'

const logger = createLogger({ namespace: 'oauth-handler' })

export function createOAuthHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: No Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw new Error('Unauthorized: Invalid token format')
    }

    if (!CLERK_SECRET_KEY) {
      throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
    }

    try {
      const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
      if (!payload.sub) {
        throw new Error('Unauthorized: Invalid token payload')
      }
      return payload.sub
    } catch (error) {
      logger.error('Token verification failed:', error)
      throw new Error('Unauthorized: Token verification failed')
    }
  }

  const gitlabAuthorize = handler(gitlabOAuthAuthorizeConfig, async (ctx) => {
    await getUserId(ctx)
    const gitlabHost = process.env.GITLAB_ROOT_OAUTH_HOST || process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com'
    const clientId = process.env.GITLAB_OAUTH_CLIENT_ID
    const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error('GitLab OAuth not configured')
    }

    const state = crypto.randomUUID()
    const scopes = 'api'

    const authUrl = new URL(`${gitlabHost}/oauth/authorize`)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('scope', scopes)

    logger.info('Initiating GitLab OAuth flow', { clientId, gitlabHost, state, redirectUri })

    return {
      authUrl: authUrl.toString(),
      state
    }
  })

  const gitlabExchange = handler(gitlabOAuthExchangeConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { projectId, code, secretName } = ctx.body

    // CRITICAL: Verify user has admin access to the project before storing OAuth token
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You must have admin access to this project to configure OAuth')
    }

    // Always use GITLAB_ROOT_OAUTH_HOST for OAuth operations
    const host = process.env.GITLAB_ROOT_OAUTH_HOST || process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com'
    const clientId = process.env.GITLAB_OAUTH_CLIENT_ID
    const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('GitLab OAuth is not configured on the server')
    }

    // Exchange code for token
    const tokenUrl = `${host}/oauth/token`
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Failed to exchange GitLab code', { status: tokenResponse.status, error: errorText })
      throw new Error(`Failed to exchange authorization code: ${errorText}`)
    }

    const tokenData = await tokenResponse.json() as any
    const { access_token, refresh_token, expires_in, scope } = tokenData

    // Calculate expiration
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Fetch user info to verify token
    const userResponse = await fetch(`${host}/api/v4/user`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    if (!userResponse.ok) {
      logger.error('Failed to fetch GitLab user', { status: userResponse.status })
      throw new Error('Failed to verify GitLab token')
    }

    const userData = await userResponse.json() as any
    logger.info('GitLab OAuth successful', { username: userData.username, host })

    // Store OAuth token as secret
    const secret = await secretQueries.upsertSecret(sql, {
      project_id: projectId,
      name: secretName,
      value: access_token,
      description: `GitLab OAuth token for ${userData.username} (auto-managed)`,
      oauth_provider: 'gitlab',
      token_type: 'oauth',
      refresh_token,
      expires_at: expiresAt.toISOString(),
      scopes: scope
    })

    logger.info('Successfully stored GitLab OAuth token', { secretId: secret.id })

    return {
      success: true,
      secretId: secret.id,
      expiresAt: expiresAt.toISOString(),
      user: {
        username: userData.username,
        name: userData.name,
        email: userData.email
      }
    }
  })

  const gitlabRefresh = handler(gitlabOAuthRefreshConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { secretId } = ctx.params

    const secret = await secretQueries.findSecretById(sql, secretId)

    if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'gitlab') {
      throw new Error('Secret is not a GitLab OAuth token')
    }

    // Verify user has access to the secret's project
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, secret.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You do not have admin access to this secret\'s project')
    }

    // Use shared refresh utility
    await refreshGitLabToken(sql, secret)

    // Fetch updated secret to get new expiration
    const updatedSecret = await secretQueries.findSecretById(sql, secretId)

    return {
      success: true,
      expiresAt: updatedSecret.expires_at || null
    }
  })

  // ============================================================================
  // JIRA OAUTH
  // ============================================================================

  const jiraAuthorize = handler(jiraOAuthAuthorizeConfig, async (ctx) => {
    await getUserId(ctx)
    const clientId = process.env.JIRA_OAUTH_CLIENT_ID
    const redirectUri = process.env.JIRA_OAUTH_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error('Jira OAuth not configured')
    }

    const state = crypto.randomUUID()
    const scopes = 'read:jira-work write:jira-work offline_access'

    // Build authorization URL
    const authUrl = new URL('https://auth.atlassian.com/authorize')
    authUrl.searchParams.set('audience', 'api.atlassian.com')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('prompt', 'consent')

    logger.info('Initiating Jira OAuth flow', { clientId, state, redirectUri })

    return {
      authUrl: authUrl.toString(),
      state
    }
  })

  const jiraExchange = handler(jiraOAuthExchangeConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { projectId, code, secretName, cloudId } = ctx.body

    // CRITICAL: Verify user has admin access to the project before storing OAuth token
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You must have admin access to this project to configure OAuth')
    }

    // Get OAuth config from environment
    const clientId = process.env.JIRA_OAUTH_CLIENT_ID
    const clientSecret = process.env.JIRA_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.JIRA_OAUTH_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Jira OAuth is not configured on the server')
    }

    // Exchange code for tokens
    const tokenUrl = 'https://auth.atlassian.com/oauth/token'
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Failed to exchange code for token', { status: tokenResponse.status, error: errorText })
      throw new Error(`Failed to exchange authorization code: ${errorText}`)
    }

    const tokenData = await tokenResponse.json() as any
    const { access_token, refresh_token, expires_in, scope } = tokenData

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Fetch accessible resources (Jira sites)
    const resourcesUrl = 'https://api.atlassian.com/oauth/token/accessible-resources'
    const resourcesResponse = await fetch(resourcesUrl, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json'
      }
    })

    if (!resourcesResponse.ok) {
      logger.error('Failed to fetch accessible resources', { status: resourcesResponse.status })
      throw new Error('Failed to fetch accessible Jira sites')
    }

    const resources = await resourcesResponse.json() as any[]
    logger.info('Fetched accessible Jira sites', { count: resources.length })

    // Store OAuth token as secret
    const secret = await secretQueries.upsertSecret(sql, {
      project_id: projectId,
      name: secretName,
      value: access_token,
      description: `Jira OAuth token (auto-managed)${cloudId ? ` for cloud ID ${cloudId}` : ''}`,
      oauth_provider: 'jira',
      token_type: 'oauth',
      refresh_token,
      expires_at: expiresAt.toISOString(),
      scopes: scope
    })

    logger.info('Successfully stored Jira OAuth token', { secretId: secret.id })

    return {
      success: true,
      secretId: secret.id,
      expiresAt: expiresAt.toISOString(),
      sites: resources.map((r: any) => ({
        id: r.id,
        url: r.url,
        name: r.name,
        scopes: r.scopes
      }))
    }
  })

  const jiraRefresh = handler(jiraOAuthRefreshConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { secretId } = ctx.params

    const secret = await secretQueries.findSecretById(sql, secretId)

    if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'jira') {
      throw new Error('Secret is not a Jira OAuth token')
    }

    // Verify user has access to the secret's project
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, secret.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You do not have admin access to this secret\'s project')
    }

    // Use shared refresh utility
    await refreshJiraToken(sql, secret)

    // Fetch updated secret to get new expiration
    const updatedSecret = await secretQueries.findSecretById(sql, secretId)

    return {
      success: true,
      expiresAt: updatedSecret.expires_at || null
    }
  })

  // ============================================================================
  // GITHUB OAUTH
  // ============================================================================

  const githubAuthorize = handler(githubOAuthAuthorizeConfig, async (ctx) => {
    await getUserId(ctx)
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error('GitHub OAuth not configured')
    }

    const state = crypto.randomUUID()
    const scopes = 'repo workflow'

    const authUrl = new URL('https://github.com/login/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('state', state)

    logger.info('Initiating GitHub OAuth flow', { clientId, state, redirectUri })

    return {
      authUrl: authUrl.toString(),
      state
    }
  })

  const githubExchange = handler(githubOAuthExchangeConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { projectId, code, secretName } = ctx.body

    // CRITICAL: Verify user has admin access to the project before storing OAuth token
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You must have admin access to this project to configure OAuth')
    }

    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('GitHub OAuth is not configured on the server')
    }

    // Exchange code for token
    const tokenUrl = 'https://github.com/login/oauth/access_token'
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Failed to exchange GitHub code', { status: tokenResponse.status, error: errorText })
      throw new Error(`Failed to exchange authorization code: ${errorText}`)
    }

    const tokenData = await tokenResponse.json() as any
    const { access_token, scope } = tokenData

    if (!access_token) {
      logger.error('No access token in GitHub response', { tokenData })
      throw new Error('Failed to obtain GitHub access token')
    }

    // Fetch user info to verify token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })

    if (!userResponse.ok) {
      logger.error('Failed to fetch GitHub user', { status: userResponse.status })
      throw new Error('Failed to verify GitHub token')
    }

    const userData = await userResponse.json() as any
    logger.info('GitHub OAuth successful', { login: userData.login })

    // Parse scopes
    const scopes = scope ? scope.split(',').map((s: string) => s.trim()) : []

    // Store OAuth token as secret (GitHub OAuth tokens don't expire)
    const secret = await secretQueries.upsertSecret(sql, {
      project_id: projectId,
      name: secretName,
      value: access_token,
      description: `GitHub OAuth token for ${userData.login} (auto-managed)`,
      oauth_provider: 'github',
      token_type: 'oauth',
      refresh_token: undefined, // GitHub OAuth tokens don't have refresh tokens
      expires_at: undefined, // GitHub OAuth tokens don't expire
      scopes: scope || ''
    })

    logger.info('Successfully stored GitHub OAuth token', { secretId: secret.id })

    return {
      success: true,
      secretId: secret.id,
      user: {
        login: userData.login,
        name: userData.name
      },
      scopes
    }
  })

  return {
    gitlabAuthorize,
    gitlabExchange,
    gitlabRefresh,
    jiraAuthorize,
    jiraExchange,
    jiraRefresh,
    githubAuthorize,
    githubExchange
  }
}
