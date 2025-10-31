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

// Route Handlers
async function handleListAllSecrets(c: any, sql: Sql) {
  const userId = await reqAuthed(c)
  const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
  const allSecrets = await queries.findAllSecrets(sql)
  const filtered = allSecrets.filter(s => accessibleProjectIds.includes(s.project_id))
  const sanitized = filtered.map(s => secretsService.sanitizeSecretForResponse(s))
  return c.json(sanitized)
}

async function handleListSecretsByProject(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { projectId } = c.req.valid('param')

  try {
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
}

async function handleGetSecretById(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
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
}

async function handleGetSecretValue(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.secret(id).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const secret = await queries.findSecretById(sql, id)
  const decryptedValue = await secretsService.getDecryptedSecretValue(sql, id)

  return c.json({
    ...secret,
    value: decryptedValue,
    encrypted_value: undefined
  })
}

async function handleCreateSecret(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const body = c.req.valid('json')
  const userId = await reqAuthed(c)

  try {
    await acl.project(body.project_id).developer.gte.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const secret = await secretsService.createEncryptedSecret(sql, body)

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
}

async function handleUpdateSecret(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  try {
    await acl.secret(id).write.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const secret = await secretsService.updateEncryptedSecret(sql, id, body)
  const sanitized = secretsService.sanitizeSecretForResponse(secret)
  return c.json(sanitized)
}

async function handleDeleteSecret(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.secret(id).write.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  await queries.deleteSecret(sql, id)
  return c.json({ success: true })
}

async function handleValidateGitLabRawToken(c: any) {
  const { token, scopes, hostname } = c.req.valid('json')
  const logger = createLogger({ namespace: 'gitlab-token-validation' })

  try {
    const client = new GitLabApiClient(hostname, token)
    const user = await client.getCurrentUser()
    logger.info(`✓ GitLab token validated: ${user.username} (${user.id})`)

    const result: any = {
      valid: true,
      user: user.username,
      userId: user.id,
      username: user.username,
      namespaceId: user.namespace_id
    }

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

      if (scopes && scopes.length > 0) {
        const missingScopes = scopes.filter((reqScope: string) =>
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
}

async function handleValidateGitLabToken(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { secretId, scopes, hostname } = c.req.valid('json')

  try {
    await acl.secret(secretId).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const result = await validateGitLabToken(sql, { secretId, scopes, hostname })

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
}

async function handleGetGitLabRepositories(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { secretId, hostname, search } = c.req.valid('json')

  try {
    await acl.secret(secretId).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const secret = await queries.findSecretById(sql, secretId)
  const token = await secretsService.getDecryptedSecretValue(sql, secretId)

  try {
    const url = new URL(`${hostname}/api/v4/projects`)
    url.searchParams.set('membership', 'true')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('order_by', 'last_activity_at')

    if (search) {
      url.searchParams.set('search', search)
    }

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
}

async function handleValidateJiraRawToken(c: any) {
  const { token, email, hostname } = c.req.valid('json')
  const logger = createLogger({ namespace: 'jira-token-validation' })

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
    return c.json({ valid: false, error: errorMsg }, 400)
  }
}

async function handleValidateJiraToken(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { secretId, hostname } = c.req.valid('json')

  try {
    await acl.secret(secretId).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const logger = createLogger({ namespace: 'jira-token-validation' })

  try {
    const secretMeta = await queries.findSecretById(sql, secretId)
    const isOAuth = secretMeta.token_type === 'oauth' && secretMeta.oauth_provider === 'jira'
    const token = await secretsService.getDecryptedSecretValue(sql, secretId)

    if (isOAuth) {
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
}

export const createSecretRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', async (c) => handleListAllSecrets(c, sql))
    .get('/by-project/:projectId', zValidator('param', projectIdParamSchema), async (c) =>
      handleListSecretsByProject(c, sql, acl)
    )
    .get('/:id', zValidator('param', idParamSchema), async (c) =>
      handleGetSecretById(c, sql, acl)
    )
    .get('/:id/value', zValidator('param', idParamSchema), async (c) =>
      handleGetSecretValue(c, sql, acl)
    )
    .post('/', zValidator('json', createSecretSchema), requireClerkAuth(), async (c) =>
      handleCreateSecret(c, sql, acl)
    )
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateSecretSchema), requireClerkAuth(), async (c) =>
      handleUpdateSecret(c, sql, acl)
    )
    .delete('/:id', zValidator('param', idParamSchema), requireClerkAuth(), async (c) =>
      handleDeleteSecret(c, sql, acl)
    )
    .post('/validate-gitlab-raw-token', zValidator('json', validateGitLabRawTokenSchema), requireClerkAuth(), async (c) =>
      handleValidateGitLabRawToken(c)
    )
    .post('/validate-gitlab-token', zValidator('json', validateGitLabTokenSchema), requireClerkAuth(), async (c) =>
      handleValidateGitLabToken(c, sql, acl)
    )
    .post('/gitlab-repositories', zValidator('json', getGitLabRepositoriesSchema), requireClerkAuth(), async (c) =>
      handleGetGitLabRepositories(c, sql, acl)
    )
    .post('/validate-jira-raw-token', zValidator('json', validateJiraRawTokenSchema), requireClerkAuth(), async (c) =>
      handleValidateJiraRawToken(c)
    )
    .post('/validate-jira-token', zValidator('json', validateJiraTokenSchema), requireClerkAuth(), async (c) =>
      handleValidateJiraToken(c, sql, acl)
    )
}
