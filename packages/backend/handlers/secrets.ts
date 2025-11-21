/**
 * Secrets handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler, type HandlerContext } from '@adi-family/http'
import {
  listSecretsConfig,
  getSecretsByProjectConfig,
  getSecretConfig,
  getSecretValueConfig,
  createSecretConfig,
  validateGitLabRawTokenConfig,
  validateGitLabTokenConfig,
  getGitLabRepositoriesConfig,
  validateJiraRawTokenConfig,
  validateJiraTokenConfig
} from '@adi/api-contracts'
import * as secretQueries from '@db/secrets'
import * as apiKeyQueries from '@db/api-keys'
import * as userAccessQueries from '@db/user-access'
import { getDecryptedSecretValue } from '../services/secrets'
import { getUserIdFromClerkToken } from '../utils/auth'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'secrets-handler' })

/**
 * Format secret for API response, excluding encrypted value
 */
function projectSecretResponse(secret: any, includeProjectId = false) {
  const response: any = {
    id: secret.id,
    name: secret.name,
    description: secret.description,
    oauth_provider: secret.oauth_provider,
    token_type: secret.token_type,
    expires_at: secret.expires_at,
    scopes: secret.scopes,
    created_at: secret.created_at,
    updated_at: secret.updated_at
  }

  if (includeProjectId) {
    response.project_id = secret.project_id
  }

  return response
}

export function createSecretHandlers(sql: Sql) {
  /**
   * Authenticate request using API key
   * Workers need to access secrets, so we support API key auth for getSecretValue
   */
  async function authenticateApiKey(ctx: HandlerContext<any, any, any>): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: No Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw new Error('Unauthorized: Invalid token format')
    }

    // Check if this is an API key (starts with adk_)
    if (!token.startsWith('adk_')) {
      throw new Error('Unauthorized: Only API key authentication is supported for this endpoint')
    }

    logger.debug('Authenticating with API key')
    const validation = await apiKeyQueries.validateApiKey(sql, token)

    if (!validation.valid || !validation.projectId) {
      throw new Error('Unauthorized: Invalid API key')
    }

    // Check if API key has permission to access secrets
    if (!validation.apiKey?.permissions?.read_project) {
      throw new Error('Forbidden: API key does not have permission to access secrets')
    }

    return validation.projectId
  }

  const listSecrets = handler(listSecretsConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))

    // Get user's accessible projects
    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)

    if (accessibleProjectIds.length === 0) {
      return []
    }

    const secrets = await secretQueries.findAllSecrets(sql)

    // Filter secrets by accessible projects and exclude the encrypted value field for security
    return secrets
      .filter(secret => accessibleProjectIds.includes(secret.project_id))
      .map(secret => projectSecretResponse(secret, true))
  })

  const getSecretsByProject = handler(getSecretsByProjectConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { projectId } = ctx.params

    // Verify user has access to the project
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId)
    if (!hasAccess) {
      throw new Error('Forbidden: You do not have access to this project')
    }

    const secrets = await secretQueries.findSecretsByProjectId(sql, projectId)
    return secrets.map(secret => projectSecretResponse(secret))
  })

  const getSecret = handler(getSecretConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { id } = ctx.params

    const secret = await secretQueries.findSecretById(sql, id)

    // Verify user has access to the secret's project
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, secret.project_id)
    if (!hasAccess) {
      throw new Error('Forbidden: You do not have access to this secret')
    }

    return projectSecretResponse(secret)
  })

  const getSecretValue = handler(getSecretValueConfig, async (ctx) => {
    const projectId = await authenticateApiKey(ctx)
    const { id } = ctx.params

    // Verify the secret belongs to the project that the API key has access to
    const secret = await secretQueries.findSecretById(sql, id)
    if (secret.project_id !== projectId) {
      throw new Error('Forbidden: API key does not have access to this secret')
    }

    const value = await getDecryptedSecretValue(sql, id)

    return {
      value,
      token_type: secret.token_type
    }
  })

  const createSecret = handler(createSecretConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const data = ctx.body

    // Verify user has admin access to the project
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, data.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You must have admin access to this project to create secrets')
    }

    const secret = await secretQueries.createSecret(sql, data as any)

    return {
      id: secret.id,
      name: secret.name,
      description: secret.description,
      created_at: secret.created_at
    }
  })

  const validateGitLabRawToken = handler(validateGitLabRawTokenConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))

    // Note: This endpoint validates a raw token before it's stored, so no project verification needed yet
    // The token will be associated with a project when it's saved via createSecret

    const { token, hostname, scopes: _scopes } = ctx.body

    try {
      const headers: Record<string, string> = {
        'PRIVATE-TOKEN': token
      }

      const response = await fetch(`${hostname}/api/v4/user`, { headers })

      if (!response.ok) {
        return {
          validated: false,
          error: `Token validation failed: ${response.status}`
        }
      }

      const user = await response.json() as any

      return {
        validated: true,
        username: user.username,
        scopeValidation: {
          validated: true,
          message: 'Token is valid'
        }
      }
    } catch (error) {
      return {
        validated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  const validateGitLabToken = handler(validateGitLabTokenConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { secretId, hostname, scopes: _scopes } = ctx.body

    try {
      const secret = await secretQueries.findSecretById(sql, secretId)

      // Verify user has access to the secret's project
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, secret.project_id)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this secret')
      }

      const token = await getDecryptedSecretValue(sql, secretId)

      const headers: Record<string, string> =
        secret.token_type === 'oauth'
          ? { 'Authorization': `Bearer ${token}` }
          : { 'PRIVATE-TOKEN': token }

      const response = await fetch(`${hostname}/api/v4/user`, { headers })

      if (!response.ok) {
        return {
          validated: false,
          error: `Token validation failed: ${response.status}`
        }
      }

      const user = await response.json() as any

      return {
        validated: true,
        username: user.username,
        scopeValidation: {
          validated: true,
          message: 'Token is valid'
        }
      }
    } catch (error) {
      return {
        validated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  const getGitLabRepositories = handler(getGitLabRepositoriesConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { secretId, host, search, perPage } = ctx.body

    try {
      const secret = await secretQueries.findSecretById(sql, secretId)

      // Verify user has access to the secret's project
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, secret.project_id)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this secret')
      }

      const token = await getDecryptedSecretValue(sql, secretId)

      // Use Search API when search term is provided for better namespace/group search
      const url = search
        ? new URL(`${host}/api/v4/search`)
        : new URL(`${host}/api/v4/projects`)

      url.searchParams.set('per_page', String(perPage || 20))

      if (search) {
        url.searchParams.set('scope', 'projects')
        url.searchParams.set('search', search)
      }

      const headers: Record<string, string> =
        secret.token_type === 'oauth'
          ? { 'Authorization': `Bearer ${token}` }
          : { 'PRIVATE-TOKEN': token }

      logger.debug('Fetching GitLab repositories', { url: url.toString(), tokenType: secret.token_type })
      const response = await fetch(url.toString(), { headers })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('GitLab API error', { status: response.status, error: errorText, url: url.toString() })
        throw new Error(`Failed to fetch repositories: ${response.status} - ${errorText}`)
      }

      const repositories = await response.json()
      return repositories
    } catch (error) {
      logger.error('Error fetching GitLab repositories', { error })
      throw new Error(error instanceof Error ? error.message : 'Unknown error')
    }
  })

  const validateJiraRawToken = handler(validateJiraRawTokenConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))

    // Note: This endpoint validates a raw token before it's stored, so no project verification needed yet

    const { token, email, hostname } = ctx.body

    try {
      const authHeader = email
        ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
        : `Bearer ${token}`

      const response = await fetch(`${hostname}/rest/api/2/myself`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        return {
          valid: false,
          error: `Token validation failed: ${response.status}`
        }
      }

      const user = await response.json() as any

      return {
        valid: true,
        username: user.displayName,
        accountId: user.accountId,
        email: user.emailAddress
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  const validateJiraToken = handler(validateJiraTokenConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { secretId, hostname } = ctx.body

    try {
      const secret = await secretQueries.findSecretById(sql, secretId)

      // Verify user has access to the secret's project
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, secret.project_id)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this secret')
      }

      const token = await getDecryptedSecretValue(sql, secretId)

      const isOAuth = secret.token_type === 'oauth' && secret.oauth_provider === 'jira'

      if (isOAuth) {
        const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          return {
            valid: false,
            error: `OAuth token validation failed: ${response.status}`
          }
        }

        const resources = await response.json() as any[]

        return {
          valid: true,
          username: `OAuth User (${resources.length} sites)`,
          accountId: 'oauth',
          email: null
        }
      } else {
        let authHeader: string
        if (token.includes(':')) {
          const [email, apiToken] = token.split(':', 2)
          authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
        } else {
          authHeader = `Bearer ${token}`
        }

        const response = await fetch(`${hostname}/rest/api/2/myself`, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        })

        if (!response.ok) {
          return {
            valid: false,
            error: `Token validation failed: ${response.status}`
          }
        }

        const user = await response.json() as any

        return {
          valid: true,
          username: user.displayName,
          accountId: user.accountId,
          email: user.emailAddress
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  return {
    listSecrets,
    getSecretsByProject,
    getSecret,
    getSecretValue,
    createSecret,
    validateGitLabRawToken,
    validateGitLabToken,
    getGitLabRepositories,
    validateJiraRawToken,
    validateJiraToken
  }
}
