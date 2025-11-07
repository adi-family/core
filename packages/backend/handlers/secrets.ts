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
import { getDecryptedSecretValue } from '../services/secrets'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'secrets-handler' })

export function createSecretHandlers(sql: Sql) {
  /**
   * Authenticate request using API key
   * Workers need to access secrets, so we only support API key auth
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

  const listSecrets = handler(listSecretsConfig, async (_ctx) => {
    const secrets = await secretQueries.findAllSecrets(sql)

    // Exclude the encrypted value field for security
    return secrets.map(secret => ({
      id: secret.id,
      name: secret.name,
      project_id: secret.project_id,
      description: secret.description,
      oauth_provider: secret.oauth_provider,
      token_type: secret.token_type,
      expires_at: secret.expires_at,
      scopes: secret.scopes,
      created_at: secret.created_at,
      updated_at: secret.updated_at
    }))
  })

  const getSecretsByProject = handler(getSecretsByProjectConfig, async (ctx) => {
    const { projectId } = ctx.params
    const secrets = await secretQueries.findSecretsByProjectId(sql, projectId)

    // Exclude the encrypted value field for security
    return secrets.map(secret => ({
      id: secret.id,
      name: secret.name,
      description: secret.description,
      oauth_provider: secret.oauth_provider,
      token_type: secret.token_type,
      expires_at: secret.expires_at,
      scopes: secret.scopes,
      created_at: secret.created_at,
      updated_at: secret.updated_at
    }))
  })

  const getSecret = handler(getSecretConfig, async (ctx) => {
    const { id } = ctx.params
    const secret = await secretQueries.findSecretById(sql, id)

    return {
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
      value
    }
  })

  const createSecret = handler(createSecretConfig, async (ctx) => {
    const data = ctx.body
    const secret = await secretQueries.createSecret(sql, data as any)

    return {
      id: secret.id,
      name: secret.name,
      description: secret.description,
      created_at: secret.created_at
    }
  })

  const validateGitLabRawToken = handler(validateGitLabRawTokenConfig, async (ctx) => {
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
    const { secretId, hostname, scopes: _scopes } = ctx.body

    try {
      const secret = await secretQueries.findSecretById(sql, secretId)
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
    const { secretId, host, search, perPage } = ctx.body

    try {
      const secret = await secretQueries.findSecretById(sql, secretId)
      const token = await getDecryptedSecretValue(sql, secretId)

      const url = new URL(`${host}/api/v4/projects`)
      url.searchParams.set('membership', 'true')
      url.searchParams.set('per_page', String(perPage || 20))
      if (search) {
        url.searchParams.set('search', search)
      }

      const headers: Record<string, string> =
        secret.token_type === 'oauth'
          ? { 'Authorization': `Bearer ${token}` }
          : { 'PRIVATE-TOKEN': token }

      const response = await fetch(url.toString(), { headers })

      if (!response.ok) {
        throw new Error(`Failed to fetch repositories: ${response.status}`)
      }

      const repositories = await response.json()
      return repositories
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Unknown error')
    }
  })

  const validateJiraRawToken = handler(validateJiraRawTokenConfig, async (ctx) => {
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
    const { secretId, hostname } = ctx.body

    try {
      const secret = await secretQueries.findSecretById(sql, secretId)
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
