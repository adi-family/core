import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/projects'
import * as secretQueries from '../../db/secrets'
import * as userAccessQueries from '../../db/user-access'
import { idParamSchema, createProjectSchema, updateProjectSchema, setJobExecutorSchema, setAIProviderEnterpriseConfigSchema, idAndProviderParamSchema } from '../schemas'
import { getClerkUserId, requireClerkAuth } from '../middleware/clerk'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { validateGitLabToken } from '../services/gitlab-executor-verifier'
import * as secretsService from '../services/secrets'
import * as aiProviderValidator from '../services/ai-provider-validator'

export const createProjectRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
      const allProjects = await queries.findAllProjects(sql)
      const filtered = allProjects.filter(p => accessibleProjectIds.includes(p.id))
      return c.json(filtered)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require viewer access
        await acl.project(id).viewer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.findProjectById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createProjectSchema), requireClerkAuth(), async (c) => {
      const body = c.req.valid('json')
      const userId = getClerkUserId(c)

      const project = await queries.createProject(sql, body)

      // Grant owner access to creator
      if (userId) {
        await userAccessQueries.grantAccess(sql, {
          user_id: userId,
          entity_type: 'project',
          entity_id: project.id,
          role: 'owner',
          granted_by: userId,
        })
      }

      return c.json(project, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateProjectSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      try {
        // Require developer access or higher
        await acl.project(id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.updateProject(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require owner access
        await acl.project(id).owner.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.deleteProject(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    // Job executor GitLab endpoints
    .get('/:id/job-executor-gitlab', zValidator('param', idParamSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')

      try {
        await acl.project(id).viewer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.getProjectJobExecutor(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      // Return config with masked token
      if (result.data) {
        return c.json({
          host: result.data.host,
          user: result.data.user,
          verified_at: result.data.verified_at,
          access_token: '***masked***'
        })
      }

      return c.json(null)
    })
    .post('/:id/job-executor-gitlab', zValidator('param', idParamSchema), zValidator('json', setJobExecutorSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')
      const { host, access_token, access_token_secret_id } = c.req.valid('json')

      try {
        await acl.project(id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Get or create the secret
      let secretId: string

      if (access_token_secret_id) {
        // Use existing secret
        const secretResult = await secretQueries.findSecretById(sql, access_token_secret_id)
        if (!secretResult.ok) {
          return c.json({ error: 'Secret not found' }, 404)
        }
        secretId = access_token_secret_id
      } else if (access_token) {
        // Upsert encrypted secret from raw token
        const secret = await secretsService.upsertEncryptedSecret(sql, {
          project_id: id,
          name: `gitlab-executor-token-${id}`,
          value: access_token,
          description: `GitLab executor token for ${host}`
        })
        secretId = secret.id
      } else {
        return c.json({ error: 'Either access_token or access_token_secret_id is required' }, 400)
      }

      // Validate the GitLab token using the new validation method
      const validationResult = await validateGitLabToken(sql, {
        secretId,
        hostname: host
      })

      if (!validationResult.valid) {
        return c.json({
          error: 'GitLab token validation failed',
          details: validationResult.error
        }, 400)
      }

      // Set executor configuration
      const executorConfig = {
        host,
        access_token_secret_id: secretId,
        verified_at: new Date().toISOString(),
        user: validationResult.username
      }

      const result = await queries.setProjectJobExecutor(sql, id, executorConfig)

      if (!result.ok) {
        return c.json({ error: result.error }, 500)
      }

      return c.json({
        host: executorConfig.host,
        user: executorConfig.user,
        verified_at: executorConfig.verified_at,
        access_token: '***masked***'
      })
    })
    .delete('/:id/job-executor-gitlab', zValidator('param', idParamSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')

      try {
        await acl.project(id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Get existing config to delete secret
      const existingConfig = await queries.getProjectJobExecutor(sql, id)
      if (existingConfig.ok && existingConfig.data) {
        // Delete the secret
        await secretQueries.deleteSecret(sql, existingConfig.data.access_token_secret_id)
      }

      // Remove executor config
      const result = await queries.removeProjectJobExecutor(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    .get('/:id/ai-providers', zValidator('param', idParamSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')

      try {
        await acl.project(id).viewer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.getProjectAIProviderConfigs(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      if (!result.data) {
        return c.json({
          anthropic: null,
          openai: null,
          google: null
        })
      }

      return c.json({
        anthropic: result.data.anthropic || null,
        openai: result.data.openai || null,
        google: result.data.google || null
      })
    })
    .put('/:id/ai-providers/:provider', zValidator('param', idAndProviderParamSchema), zValidator('json', setAIProviderEnterpriseConfigSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')
      const { provider } = c.req.valid('param')
      const config = c.req.valid('json')

      try {
        await acl.project(id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      let secretId: string

      // Check if api_key_secret_id is provided or if we need to create a secret from api_key
      const configWithSecretId = config as any

      if (configWithSecretId.api_key_secret_id) {
        const secretResult = await secretQueries.findSecretById(sql, configWithSecretId.api_key_secret_id)
        if (!secretResult.ok) {
          return c.json({ error: 'Secret not found' }, 404)
        }
        secretId = configWithSecretId.api_key_secret_id
      } else if (configWithSecretId.api_key) {
        // Upsert secret (insert or update if exists)
        const secret = await secretsService.upsertEncryptedSecret(sql, {
          project_id: id,
          name: `${provider}-api-key-${id}-${config.type}`,
          value: configWithSecretId.api_key,
          description: `${provider.charAt(0).toUpperCase() + provider.slice(1)} ${config.type} API key`
        })
        secretId = secret.id
      } else {
        return c.json({ error: 'Either api_key or api_key_secret_id is required' }, 400)
      }

      // Build the final config with api_key_secret_id
      const finalConfig = {
        ...config,
        api_key_secret_id: secretId
      }
      delete (finalConfig as any).api_key

      const result = await queries.setProjectAIProviderConfig(sql, id, provider, finalConfig as any)

      if (!result.ok) {
        return c.json({ error: result.error }, 500)
      }

      return c.json({
        provider,
        type: config.type,
        configured: true
      })
    })
    .delete('/:id/ai-providers/:provider', zValidator('param', idAndProviderParamSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')
      const { provider } = c.req.valid('param')

      try {
        await acl.project(id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const providerConfig = await queries.getProjectAIProviderConfig(sql, id, provider)
      if (providerConfig.ok && providerConfig.data) {
        const secretId = providerConfig.data.api_key_secret_id
        if (secretId) {
          await secretQueries.deleteSecret(sql, secretId)
        }
      }

      const result = await queries.removeProjectAIProviderConfig(sql, id, provider)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    .post('/:id/ai-providers/:provider/validate', zValidator('param', idAndProviderParamSchema), zValidator('json', setAIProviderEnterpriseConfigSchema), requireClerkAuth(), async (c) => {
      const { id } = c.req.valid('param')
      const { provider } = c.req.valid('param')
      const config = c.req.valid('json')

      try {
        await acl.project(id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Get the API key from the config or from secret_id
      const configWithKey = config as any
      let apiKey: string

      if (configWithKey.api_key) {
        apiKey = configWithKey.api_key
      } else if (configWithKey.api_key_secret_id) {
        try {
          apiKey = await secretsService.getDecryptedSecretValue(sql, configWithKey.api_key_secret_id)
        } catch {
          return c.json({ error: 'Failed to retrieve API key from secret' }, 400)
        }
      } else {
        return c.json({ error: 'Either api_key or api_key_secret_id is required' }, 400)
      }

      // Validate the configuration
      const validationResult = await aiProviderValidator.validateAIProviderConfig(
        provider,
        config as any,
        apiKey
      )

      return c.json(validationResult)
    })
}

