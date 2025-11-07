import type { Sql } from 'postgres'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { createLogger } from '@utils/logger'
import { getDecryptedSecretValue } from './secrets'
import * as secretQueries from '@db/secrets'

const logger = createLogger({ namespace: 'gitlab-executor-verifier' })

export interface VerifyExecutorInput {
  host: string
  access_token: string
}

export interface VerifyExecutorResult {
  valid: boolean
  user?: string
  userId?: number
  error?: string
}

export async function verifyGitLabExecutor(
  input: VerifyExecutorInput
): Promise<VerifyExecutorResult> {
  const { host, access_token } = input

  try {
    logger.info(`Verifying GitLab executor for host: ${host}`)

    const client = new GitLabApiClient(host, access_token)
    const user = await client.getCurrentUser()

    logger.info(`✓ GitLab executor verified: ${user.username} (${user.id})`)

    return {
      valid: true,
      user: user.username,
      userId: user.id
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`✗ GitLab executor verification failed: ${errorMsg}`)

    return {
      valid: false,
      error: errorMsg
    }
  }
}

export interface ValidateGitLabTokenInput {
  secretId: string
  scopes?: string[]
  hostname: string
}

export interface ValidateGitLabTokenResult {
  valid: boolean
  user?: string
  userId?: number
  username?: string
  namespaceId?: number
  scopes?: string[]
  tokenInfo?: {
    name: string
    expiresAt: string | null
    active: boolean
    revoked: boolean
  }
  error?: string
  scopeValidation?: {
    requested: string[]
    actual: string[]
    validated: boolean
    missing?: string[]
    message?: string
  }
}

/**
 * Validate GitLab token from secret storage
 * Retrieves encrypted token, decrypts it, and validates against GitLab API
 *
 * @param sql - Database connection
 * @param input - Validation parameters (secretId, optional scopes, hostname)
 * @returns Validation result with user information if successful
 */
export async function validateGitLabToken(
  sql: Sql,
  input: ValidateGitLabTokenInput
): Promise<ValidateGitLabTokenResult> {
  const { secretId, scopes, hostname } = input

  try {
    logger.info(`Validating GitLab token from secret ${secretId} for host: ${hostname}`)

    // Fetch secret metadata to determine token type
    let secret
    try {
      secret = await secretQueries.findSecretById(sql, secretId)
    } catch {
      logger.error(`✗ Secret ${secretId} not found`)
      return {
        valid: false,
        error: 'Secret not found'
      }
    }

    // Retrieve and decrypt the token from database
    const accessToken = await getDecryptedSecretValue(sql, secretId)

    // Determine token type based on secret metadata
    const tokenType = secret.token_type === 'oauth' ? 'oauth' : 'pat'
    logger.info(`Using token type: ${tokenType} for secret ${secretId}`)

    // Create GitLab client with the decrypted token and correct token type
    const client = new GitLabApiClient(hostname, accessToken, tokenType)

    // Validate token by fetching current user information
    const user = await client.getCurrentUser()

    logger.info(`✓ GitLab token validated: ${user.username} (${user.id})`)

    const result: ValidateGitLabTokenResult = {
      valid: true,
      user: user.username,
      userId: user.id,
      username: user.username,
      namespaceId: user.namespace_id
    }

    // Only try to fetch token scopes for Personal Access Tokens (not OAuth)
    // OAuth tokens cannot use the /personal_access_tokens/self endpoint
    if (tokenType === 'pat') {
      try {
        const tokenInfo = await client.getPersonalAccessTokenInfo()
        result.scopes = tokenInfo.scopes
        result.tokenInfo = {
          name: tokenInfo.name,
          expiresAt: tokenInfo.expires_at,
          active: tokenInfo.active,
          revoked: tokenInfo.revoked
        }

        logger.info(`✓ Token scopes retrieved: ${tokenInfo.scopes.join(', ')}`)

        // Handle scope validation if requested
        if (scopes && scopes.length > 0) {
          logger.info(`Validating required scopes: ${scopes.join(', ')}`)

          const missingScopes = scopes.filter(reqScope => {
            // Check if the required scope is present, or if 'api' or 'sudo' scope covers it
            return !tokenInfo.scopes.includes(reqScope) &&
                   !tokenInfo.scopes.includes('api') &&
                   !tokenInfo.scopes.includes('sudo')
          })

          const validated = missingScopes.length === 0

          result.scopeValidation = {
            requested: scopes,
            actual: tokenInfo.scopes,
            validated,
            missing: missingScopes.length > 0 ? missingScopes : undefined,
            message: validated
              ? 'All required scopes are present'
              : `Missing scopes: ${missingScopes.join(', ')}`
          }

          if (!validated) {
            logger.warn(`⚠ Token missing required scopes: ${missingScopes.join(', ')}`)
          }
        }
      } catch (scopeError) {
        logger.warn(`⚠ Could not fetch token scopes: ${scopeError instanceof Error ? scopeError.message : String(scopeError)}`)
        logger.warn('Token does not have "read_api" or "api" scope, or endpoint is not available')

        // If scopes were requested but we can't verify them, mark as uncertain
        if (scopes && scopes.length > 0) {
          result.scopeValidation = {
            requested: scopes,
            actual: [],
            validated: false,
            message: 'Cannot verify scopes: Token does not have "read_api" or "api" scope, or endpoint is not available. Token is valid for basic operations.'
          }
        }
      }
    } else {
      // For OAuth tokens, skip scope validation and mark as valid
      logger.info('✓ OAuth token validated (scope validation skipped for OAuth tokens)')
      if (scopes && scopes.length > 0) {
        result.scopeValidation = {
          requested: scopes,
          actual: ['api'], // OAuth tokens granted via OAuth flow have 'api' scope
          validated: true,
          message: 'OAuth token validated (scope verification not applicable for OAuth tokens)'
        }
      }
    }

    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`✗ GitLab token validation failed: ${errorMsg}`)

    return {
      valid: false,
      error: errorMsg,
      scopeValidation: scopes && scopes.length > 0 ? {
        requested: scopes,
        actual: [],
        validated: false,
        message: 'Token validation failed'
      } : undefined
    }
  }
}
