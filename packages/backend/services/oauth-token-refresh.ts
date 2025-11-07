/**
 * OAuth Token Refresh Service
 * Handles automatic refresh of expired OAuth tokens
 */

import type { Sql } from 'postgres'
import type { Secret } from '@types'
import { findSecretById, updateSecret } from '@db/secrets'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'oauth-token-refresh' })

export function isTokenExpiredOrExpiringSoon(secret: Secret, bufferMinutes = 5): boolean {
  if (!secret.expires_at) {
    return false
  }

  const expiresAt = new Date(secret.expires_at)
  const now = new Date()
  const bufferMs = bufferMinutes * 60 * 1000

  return expiresAt <= new Date(now.getTime() + bufferMs)
}

export async function refreshGitLabToken(sql: Sql, secret: Secret): Promise<string> {
  const clientId = process.env.GITLAB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITLAB_OAUTH_CLIENT_SECRET
  const gitlabHost = process.env.GITLAB_ROOT_OAUTH_HOST || process.env.GITLAB_OAUTH_HOST || 'https://gitlab.com'

  if (!clientId || !clientSecret) {
    throw new Error('GitLab OAuth is not configured (missing GITLAB_OAUTH_CLIENT_ID or GITLAB_OAUTH_CLIENT_SECRET)')
  }

  if (!secret.refresh_token) {
    throw new Error('No refresh token available for this secret')
  }

  logger.info(`🔄 Refreshing GitLab OAuth token for secret ${secret.id}...`)

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
    logger.error(`❌ Failed to refresh GitLab token: ${errorText}`, { status: tokenResponse.status, secretId: secret.id })
    throw new Error(`Failed to refresh GitLab token: ${errorText}`)
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  }

  const { access_token, refresh_token, expires_in, scope } = tokenData
  const expiresAt = new Date(Date.now() + expires_in * 1000)

  // Update secret in database
  await updateSecret(sql, secret.id, {
    value: access_token,
    refresh_token: refresh_token || secret.refresh_token,
    expires_at: expiresAt.toISOString(),
    scopes: scope || secret.scopes || undefined
  })

  logger.info(`✓ GitLab OAuth token refreshed successfully`, {
    secretId: secret.id,
    expiresAt: expiresAt.toISOString(),
    expiresIn: `${Math.floor(expires_in / 60)} minutes`
  })

  return access_token
}

export async function refreshJiraToken(sql: Sql, secret: Secret): Promise<string> {
  const clientId = process.env.JIRA_OAUTH_CLIENT_ID
  const clientSecret = process.env.JIRA_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Jira OAuth is not configured (missing JIRA_OAUTH_CLIENT_ID or JIRA_OAUTH_CLIENT_SECRET)')
  }

  if (!secret.refresh_token) {
    throw new Error('No refresh token available for this secret')
  }

  logger.info(`🔄 Refreshing Jira OAuth token for secret ${secret.id}...`)

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
    logger.error(`❌ Failed to refresh Jira token: ${errorText}`, { status: tokenResponse.status, secretId: secret.id })
    throw new Error(`Failed to refresh Jira token: ${errorText}`)
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope?: string
  }

  const { access_token, refresh_token, expires_in, scope } = tokenData
  const expiresAt = new Date(Date.now() + expires_in * 1000)

  await updateSecret(sql, secret.id, {
    value: access_token,
    refresh_token: refresh_token || secret.refresh_token,
    expires_at: expiresAt.toISOString(),
    scopes: scope || secret.scopes || undefined
  })

  logger.info(`✓ Jira OAuth token refreshed successfully`, {
    secretId: secret.id,
    expiresAt: expiresAt.toISOString(),
    expiresIn: `${Math.floor(expires_in / 60)} minutes`
  })

  return access_token
}

export async function getValidOAuthToken(
  sql: Sql,
  secretId: string,
  bufferMinutes = 5
): Promise<string> {
  const secret = await findSecretById(sql, secretId)

  if (secret.token_type !== 'oauth') {
    return secret.value
  }

  if (isTokenExpiredOrExpiringSoon(secret, bufferMinutes)) {
    const expiresAt = secret.expires_at ? new Date(secret.expires_at) : null
    const now = new Date()
    const status = expiresAt && expiresAt < now ? 'expired' : 'expiring soon'

    logger.info(`⏰ OAuth token is ${status}`, {
      secretId: secret.id,
      provider: secret.oauth_provider,
      expiresAt: secret.expires_at,
      timeUntilExpiry: expiresAt ? `${Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)} minutes` : 'N/A'
    })

    switch (secret.oauth_provider) {
      case 'gitlab':
        return await refreshGitLabToken(sql, secret)
      case 'jira':
        return await refreshJiraToken(sql, secret)
      default:
        logger.warn(`⚠️  Unknown OAuth provider: ${secret.oauth_provider}, returning existing token`)
        return secret.value
    }
  }

  return secret.value
}
