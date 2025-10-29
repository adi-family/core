import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/secrets'
import { z } from 'zod'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { reqAuthed } from '../middleware/authz'
import { requireClerkAuth } from '../middleware/clerk'
import * as userAccessQueries from '../../db/user-access'
import * as secretsService from '../services/secrets'
import { validateGitLabToken } from '../services/gitlab-executor-verifier'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { createLogger } from '@utils/logger'

const idParamSchema = z.object({
  id: z.string()
})

const projectIdParamSchema = z.object({
  projectId: z.string()
})

const createSecretSchema = z.object({
  project_id: z.string(),
  name: z.string(),
  value: z.string(),
  description: z.string().optional()
})

const updateSecretSchema = z.object({
  value: z.string().optional(),
  description: z.string().optional()
})

const validateGitLabTokenSchema = z.object({
  secretId: z.string(),
  scopes: z.array(z.string()).optional(),
  hostname: z.string()
})

const validateGitLabRawTokenSchema = z.object({
  token: z.string(),
  scopes: z.array(z.string()).optional(),
  hostname: z.string()
})

const validateJiraRawTokenSchema = z.object({
  token: z.string(),
  email: z.string().email().optional(),
  hostname: z.string()
})

const validateJiraTokenSchema = z.object({
  secretId: z.string(),
  hostname: z.string()
})

const getGitLabRepositoriesSchema = z.object({
  secretId: z.string(),
  hostname: z.string(),
  search: z.string().optional()
})

export const createSecretRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', async (c) => {
      const userId = await reqAuthed(c)

      const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
      const allSecrets = await queries.findAllSecrets(sql)
      const filtered = allSecrets.filter(s => accessibleProjectIds.includes(s.project_id))
      const sanitized = filtered.map(s => secretsService.sanitizeSecretForResponse(s))
      return c.json(sanitized)
    })
    .get('/by-project/:projectId', zValidator('param', projectIdParamSchema), async (c) => {
      const { projectId } = c.req.valid('param')

      try {
        // Require viewer access to project to see secrets
        await acl.project(projectId).viewer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const secrets = await queries.findSecretsByProjectId(sql, projectId)
      const sanitized = secrets.map(s => secretsService.sanitizeSecretForResponse(s))
      return c.json(sanitized)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access
        await acl.secret(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const secret = await queries.findSecretById(sql, id)

      const sanitized = secretsService.sanitizeSecretForResponse(secret)
      return c.json(sanitized)
    })
    .get('/:id/value', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access for decrypted value
        await acl.secret(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const secret = await queries.findSecretById(sql, id)

      // Return full secret data with decrypted value (for backend services)
      const decryptedValue = await secretsService.getDecryptedSecretValue(sql, id)

      return c.json({
        ...secret,
        value: decryptedValue,
        encrypted_value: undefined // Don't expose encrypted value
      })
    })
    .post('/', zValidator('json', createSecretSchema), requireClerkAuth(), async (c) => {
      const body = c.req.valid('json')
      const userId = await reqAuthed(c)

      try {
        // Require developer access to project to create secrets
        await acl.project(body.project_id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const secret = await secretsService.createEncryptedSecret(sql, body)

      // Grant read access to creator
      if (userId) {
        await userAccessQueries.grantAccess(sql, {
          user_id: userId,
          entity_type: 'secret',
          entity_id: secret.id,
          role: 'read',
          granted_by: userId,
        })
      }

      const sanitized = secretsService.sanitizeSecretForResponse(secret)
      return c.json(sanitized, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateSecretSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      try {
        // Require write access to secret (inherits developer from project)
        await acl.secret(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await secretsService.updateEncryptedSecret(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      const sanitized = secretsService.sanitizeSecretForResponse(result.data)
      return c.json(sanitized)
    })
    .delete('/:id', zValidator('param', idParamSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require write access to secret (inherits developer from project)
        await acl.secret(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      await queries.deleteSecret(sql, id)

      return c.json({ success: true })
    })
    .post('/validate-gitlab-raw-token', zValidator('json', validateGitLabRawTokenSchema), requireClerkAuth(), async (c) => {
      const { token, scopes, hostname } = c.req.valid('json')
      const logger = createLogger({ namespace: 'gitlab-token-validation' })

      try {
        // Create GitLab client with the provided token
        const client = new GitLabApiClient(hostname, token)

        // Validate token by fetching current user information
        const user = await client.getCurrentUser()

        logger.info(`✓ GitLab token validated: ${user.username} (${user.id})`)

        const result: any = {
          valid: true,
          user: user.username,
          userId: user.id,
          username: user.username,
          namespaceId: user.namespace_id
        }

        // Try to fetch token scopes
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

          // Validate required scopes if provided
          if (scopes && scopes.length > 0) {
            const missingScopes = scopes.filter(reqScope =>
              !tokenInfo.scopes.includes(reqScope) &&
              !tokenInfo.scopes.includes('api') &&
              !tokenInfo.scopes.includes('sudo')
            )

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
          }
        } catch (scopeError) {
          logger.warn(`⚠ Could not fetch token scopes: ${scopeError instanceof Error ? scopeError.message : String(scopeError)}`)

          // If scopes were requested but we can't verify them
          if (scopes && scopes.length > 0) {
            result.scopeValidation = {
              requested: scopes,
              actual: [],
              validated: false,
              message: 'Cannot verify scopes: Token may not have "read_api" or "api" scope. Token is valid for basic operations.'
            }
          }
        }

        return c.json(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        return c.json({
          valid: false,
          error: errorMsg,
          scopeValidation: scopes && scopes.length > 0 ? {
            requested: scopes,
            actual: [],
            validated: false,
            message: 'Token validation failed'
          } : undefined
        }, 400)
      }
    })
    .post('/validate-gitlab-token', zValidator('json', validateGitLabTokenSchema), requireClerkAuth(), async (c) => {
      const { secretId, scopes, hostname } = c.req.valid('json')

      try {
        // Require read access to the secret
        await acl.secret(secretId).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Validate the GitLab token
      const result = await validateGitLabToken(sql, {
        secretId,
        scopes,
        hostname
      })

      if (!result.valid) {
        return c.json({
          valid: false,
          error: result.error,
          scopeValidation: result.scopeValidation
        }, 400)
      }

      return c.json({
        valid: true,
        user: result.user,
        userId: result.userId,
        username: result.username,
        namespaceId: result.namespaceId,
        scopeValidation: result.scopeValidation
      })
    })
    .post('/gitlab-repositories', zValidator('json', getGitLabRepositoriesSchema), requireClerkAuth(), async (c) => {
      const { secretId, hostname, search } = c.req.valid('json')

      try {
        // Require read access to the secret
        await acl.secret(secretId).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Fetch secret metadata to determine token type
      const secret = await queries.findSecretById(sql, secretId)

      // Get decrypted token
      const token = await secretsService.getDecryptedSecretValue(sql, secretId)
      if (!token) {
        return c.json({ error: 'Token not found or could not be decrypted' }, 400)
      }

      // Fetch repositories from GitLab
      try {
        const url = new URL(`${hostname}/api/v4/projects`)
        url.searchParams.set('membership', 'true')
        url.searchParams.set('per_page', '100')
        url.searchParams.set('order_by', 'last_activity_at')

        if (search) {
          url.searchParams.set('search', search)
        }

        // Use appropriate authentication header based on token type
        const headers: Record<string, string> = {}
        if (secret.token_type === 'oauth') {
          headers['Authorization'] = `Bearer ${token}`
        } else {
          headers['PRIVATE-TOKEN'] = token
        }

        const response = await fetch(url.toString(), { headers })

        if (!response.ok) {
          return c.json({
            error: `Failed to fetch repositories: ${response.status} ${response.statusText}`
          }, 500)
        }

        const repositories = await response.json()
        return c.json(repositories)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        return c.json({ error: `Error fetching repositories: ${errorMsg}` }, 500)
      }
    })
    .post('/validate-jira-raw-token', zValidator('json', validateJiraRawTokenSchema), requireClerkAuth(), async (c) => {
      const { token, email, hostname } = c.req.valid('json')
      const logger = createLogger({ namespace: 'jira-token-validation' })

      try {
        // Jira Cloud uses email + API token authentication
        // Try to fetch current user information to validate the token
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
          const errorText = await response.text()
          logger.error(`✗ Jira token validation failed: ${response.status} ${response.statusText} - ${errorText}`)
          return c.json({
            valid: false,
            error: `Token validation failed: ${response.status} ${response.statusText}`
          }, 400)
        }

        const user = await response.json() as any

        logger.info(`✓ Jira token validated: ${user.displayName} (${user.accountId})`)

        const result: any = {
          valid: true,
          username: user.displayName,
          accountId: user.accountId,
          email: user.emailAddress
        }

        return c.json(result)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error(`✗ Jira token validation error: ${errorMsg}`)

        return c.json({
          valid: false,
          error: errorMsg
        }, 400)
      }
    })
    .post('/validate-jira-token', zValidator('json', validateJiraTokenSchema), requireClerkAuth(), async (c) => {
      const { secretId, hostname } = c.req.valid('json')

      try {
        // Require read access to the secret
        await acl.secret(secretId).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }
      const logger = createLogger({ namespace: 'jira-token-validation' })

      try {
        // Get secret metadata to check if it's OAuth
        const secretMeta = await queries.findSecretById(sql, secretId)
        const isOAuth = secretMeta.token_type === 'oauth' && secretMeta.oauth_provider === 'jira'

        // Get decrypted token
        const token = await secretsService.getDecryptedSecretValue(sql, secretId)

        if (isOAuth) {
          // OAuth token validation - use Atlassian API to fetch accessible resources
          logger.info('Validating Jira OAuth token via accessible-resources endpoint')

          const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          })

          if (!resourcesResponse.ok) {
            const errorText = await resourcesResponse.text()
            logger.error(`✗ OAuth token validation failed: ${resourcesResponse.status} - ${errorText}`)
            return c.json({
              valid: false,
              error: `OAuth token validation failed: ${resourcesResponse.status}. The token may be expired.`
            }, 400)
          }

          const resources = await resourcesResponse.json() as any[]
          logger.info(`✓ OAuth token validated. Accessible sites: ${resources.length}`)

          return c.json({
            valid: true,
            username: resources.length > 0 ? `OAuth User (${resources.length} sites)` : 'OAuth User',
            accountId: 'oauth',
            email: null
          })
        } else {
          // API token validation - use hostname
          // Try to parse if it's email:token format
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
            const errorText = await response.text()
            logger.error(`✗ Jira token validation failed: ${response.status} ${response.statusText} - ${errorText}`)
            return c.json({
              valid: false,
              error: `Token validation failed: ${response.status} ${response.statusText}. The token may be invalid or expired.`
            }, 400)
          }

          const user = await response.json() as any

          logger.info(`✓ Jira token validated: ${user.displayName} (${user.accountId})`)

          return c.json({
            valid: true,
            username: user.displayName,
            accountId: user.accountId,
            email: user.emailAddress
          })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error(`✗ Jira token validation error: ${errorMsg}`)

        return c.json({
          valid: false,
          error: `Failed to validate token: ${errorMsg}`
        }, 400)
      }
    })
}
