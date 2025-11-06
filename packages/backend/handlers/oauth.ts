/**
 * OAuth handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  gitlabOAuthAuthorizeConfig,
  gitlabOAuthExchangeConfig,
  gitlabOAuthRefreshConfig,
  jiraOAuthAuthorizeConfig,
  jiraOAuthExchangeConfig,
  jiraOAuthRefreshConfig
} from '@adi/api-contracts'
import * as secretQueries from '@db/secrets'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'oauth-handler' })

export function createOAuthHandlers(sql: Sql) {
  const gitlabAuthorize = handler(gitlabOAuthAuthorizeConfig, async (_ctx) => {
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
    const { projectId, code, secretName } = ctx.body

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
    const { secretId } = ctx.params

    const clientId = process.env.GITLAB_OAUTH_CLIENT_ID
    const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET
    const gitlabHost = process.env.GITLAB_ROOT_OAUTH_HOST || process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com'

    if (!clientId || !clientSecret) {
      throw new Error('GitLab OAuth is not configured')
    }

    const secret = await secretQueries.findSecretById(sql, secretId)

    if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'gitlab') {
      throw new Error('Secret is not a GitLab OAuth token')
    }

    if (!secret.refresh_token) {
      throw new Error('No refresh token available')
    }

    // Refresh the token
    const tokenUrl = `${gitlabHost}/oauth/token`
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: secret.refresh_token,
        grant_type: 'refresh_token'
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Failed to refresh GitLab token', { status: tokenResponse.status, error: errorText })
      throw new Error(`Failed to refresh token: ${errorText}`)
    }

    const tokenData = await tokenResponse.json() as any
    const { access_token, refresh_token, expires_in, scope } = tokenData

    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Update secret
    await secretQueries.updateSecret(sql, secretId, {
      value: access_token,
      refresh_token: refresh_token || secret.refresh_token,
      expires_at: expiresAt.toISOString(),
      scopes: scope || secret.scopes
    })

    logger.info('Successfully refreshed GitLab OAuth token', { secretId })

    return {
      success: true,
      expiresAt: expiresAt.toISOString()
    }
  })

  // ============================================================================
  // JIRA OAUTH
  // ============================================================================

  const jiraAuthorize = handler(jiraOAuthAuthorizeConfig, async (ctx) => {
    const { client_id, redirect_uri, scopes } = ctx.query || {}
    const state = crypto.randomUUID()

    const scopeStr = scopes || 'read:jira-work write:jira-work offline_access'

    // Build authorization URL
    const authUrl = new URL('https://auth.atlassian.com/authorize')
    authUrl.searchParams.set('audience', 'api.atlassian.com')
    authUrl.searchParams.set('client_id', client_id)
    authUrl.searchParams.set('scope', scopeStr)
    authUrl.searchParams.set('redirect_uri', redirect_uri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('prompt', 'consent')

    logger.info('Initiating Jira OAuth flow', { client_id, state })

    return {
      authUrl: authUrl.toString(),
      state
    }
  })

  const jiraExchange = handler(jiraOAuthExchangeConfig, async (ctx) => {
    const { projectId, code, secretName, cloudId } = ctx.body

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
    const { secretId } = ctx.params

    // Get OAuth config from environment
    const clientId = process.env.JIRA_OAUTH_CLIENT_ID
    const clientSecret = process.env.JIRA_OAUTH_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Jira OAuth is not configured on the server')
    }

    // Fetch existing secret
    const secret = await secretQueries.findSecretById(sql, secretId)

    // Verify it's an OAuth token
    if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'jira') {
      throw new Error('Secret is not a Jira OAuth token')
    }

    if (!secret.refresh_token) {
      throw new Error('No refresh token available')
    }

    // Refresh the token
    const tokenUrl = 'https://auth.atlassian.com/oauth/token'
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: secret.refresh_token
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      logger.error('Failed to refresh token', { status: tokenResponse.status, error: errorText })
      throw new Error(`Failed to refresh token: ${errorText}`)
    }

    const tokenData = await tokenResponse.json() as any
    const { access_token, refresh_token, expires_in, scope } = tokenData

    // Calculate new expiration
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    // Update secret with new token
    await secretQueries.updateSecret(sql, secretId, {
      value: access_token,
      refresh_token: refresh_token || secret.refresh_token, // Keep old refresh token if new one not provided
      expires_at: expiresAt.toISOString(),
      scopes: scope || secret.scopes
    })

    logger.info('Successfully refreshed Jira OAuth token', { secretId })

    return {
      success: true,
      expiresAt: expiresAt.toISOString()
    }
  })

  return {
    gitlabAuthorize,
    gitlabExchange,
    gitlabRefresh,
    jiraAuthorize,
    jiraExchange,
    jiraRefresh
  }
}
