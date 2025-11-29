/**
 * OAuth handlers using @adi/http system
 */

import type { Sql } from 'postgres'
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
import { createLogger } from '@utils/logger'
import { buildUrl } from '@utils/url'
import { refreshGitLabToken, refreshJiraToken } from '@backend/services/oauth-token-refresh'
import { createSecuredHandlers } from '../utils/auth'
import { GitLabApiClient } from '@shared/gitlab-api-client'

const logger = createLogger({ namespace: 'oauth-handler' })

export function createOAuthHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  const gitlabAuthorize = handler(gitlabOAuthAuthorizeConfig, async () => {
    const gitlabHost = process.env.GITLAB_ROOT_OAUTH_HOST || process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com'
    const clientId = process.env.GITLAB_OAUTH_CLIENT_ID
    const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error('GitLab OAuth not configured')
    }

    const state = crypto.randomUUID()
    const authUrl = buildUrl(`${gitlabHost}/oauth/authorize`, {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: 'api'
    })

    logger.info('Initiating GitLab OAuth flow', { clientId, gitlabHost, state, redirectUri })
    return { authUrl, state }
  })

  const gitlabExchange = handler(gitlabOAuthExchangeConfig, async (ctx) => {
    const { projectId, code, secretName } = ctx.body
    await ctx.acl.project(projectId).admin()

    const host = process.env.GITLAB_ROOT_OAUTH_HOST || process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com'
    const clientId = process.env.GITLAB_OAUTH_CLIENT_ID
    const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('GitLab OAuth is not configured on the server')
    }

    const tokenResponse = await fetch(`${host}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    const gitlabClient = new GitLabApiClient(host, access_token, 'oauth')
    const userData = await gitlabClient.getCurrentUser()
    logger.info('GitLab OAuth successful', { username: userData.username, host })

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
      user: { username: userData.username, name: userData.name, email: userData.email }
    }
  })

  const gitlabRefresh = handler(gitlabOAuthRefreshConfig, async (ctx) => {
    const { secretId } = ctx.params
    const secret = await secretQueries.findSecretById(sql, secretId)

    if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'gitlab') {
      throw new Error('Secret is not a GitLab OAuth token')
    }

    await ctx.acl.project(secret.project_id).admin()
    await refreshGitLabToken(sql, secret)

    const updatedSecret = await secretQueries.findSecretById(sql, secretId)
    return { success: true, expiresAt: updatedSecret.expires_at || null }
  })

  // ============================================================================
  // JIRA OAUTH
  // ============================================================================

  const jiraAuthorize = handler(jiraOAuthAuthorizeConfig, async () => {
    const clientId = process.env.JIRA_OAUTH_CLIENT_ID
    const redirectUri = process.env.JIRA_OAUTH_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error('Jira OAuth not configured')
    }

    const state = crypto.randomUUID()
    const authUrl = buildUrl('https://auth.atlassian.com/authorize', {
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: 'read:jira-work write:jira-work offline_access',
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent'
    })

    logger.info('Initiating Jira OAuth flow', { clientId, state, redirectUri })
    return { authUrl, state }
  })

  const jiraExchange = handler(jiraOAuthExchangeConfig, async (ctx) => {
    const { projectId, code, secretName, cloudId } = ctx.body
    await ctx.acl.project(projectId).admin()

    const clientId = process.env.JIRA_OAUTH_CLIENT_ID
    const clientSecret = process.env.JIRA_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.JIRA_OAUTH_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Jira OAuth is not configured on the server')
    }

    const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const expiresAt = new Date(Date.now() + expires_in * 1000)

    const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' }
    })

    if (!resourcesResponse.ok) {
      logger.error('Failed to fetch accessible resources', { status: resourcesResponse.status })
      throw new Error('Failed to fetch accessible Jira sites')
    }

    const resources = await resourcesResponse.json() as any[]
    logger.info('Fetched accessible Jira sites', { count: resources.length })

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
      sites: resources.map((r: any) => ({ id: r.id, url: r.url, name: r.name, scopes: r.scopes }))
    }
  })

  const jiraRefresh = handler(jiraOAuthRefreshConfig, async (ctx) => {
    const { secretId } = ctx.params
    const secret = await secretQueries.findSecretById(sql, secretId)

    if (secret.token_type !== 'oauth' || secret.oauth_provider !== 'jira') {
      throw new Error('Secret is not a Jira OAuth token')
    }

    await ctx.acl.project(secret.project_id).admin()
    await refreshJiraToken(sql, secret)

    const updatedSecret = await secretQueries.findSecretById(sql, secretId)
    return { success: true, expiresAt: updatedSecret.expires_at || null }
  })

  // ============================================================================
  // GITHUB OAUTH
  // ============================================================================

  const githubAuthorize = handler(githubOAuthAuthorizeConfig, async () => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI

    if (!clientId || !redirectUri) {
      throw new Error('GitHub OAuth not configured')
    }

    const state = crypto.randomUUID()
    const authUrl = buildUrl('https://github.com/login/oauth/authorize', {
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo workflow',
      state
    })

    logger.info('Initiating GitHub OAuth flow', { clientId, state, redirectUri })
    return { authUrl, state }
  })

  const githubExchange = handler(githubOAuthExchangeConfig, async (ctx) => {
    const { projectId, code, secretName } = ctx.body
    await ctx.acl.project(projectId).admin()

    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('GitHub OAuth is not configured on the server')
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
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

    const scopes = scope ? scope.split(',').map((s: string) => s.trim()) : []

    const secret = await secretQueries.upsertSecret(sql, {
      project_id: projectId,
      name: secretName,
      value: access_token,
      description: `GitHub OAuth token for ${userData.login} (auto-managed)`,
      oauth_provider: 'github',
      token_type: 'oauth',
      refresh_token: undefined,
      expires_at: undefined,
      scopes: scope || ''
    })

    logger.info('Successfully stored GitHub OAuth token', { secretId: secret.id })

    return {
      success: true,
      secretId: secret.id,
      user: { login: userData.login, name: userData.name },
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
