import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/projects'
import * as secretQueries from '../../db/secrets'
import * as userAccessQueries from '../../db/user-access'
import * as workerRepoQueries from '../../db/worker-repositories'
import { idParamSchema, createProjectSchema, updateProjectSchema, setJobExecutorSchema, setAIProviderEnterpriseConfigSchema, idAndProviderParamSchema } from '../schemas'
import { requireClerkAuth } from '../middleware/clerk'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { validateGitLabToken } from '../services/gitlab-executor-verifier'
import * as secretsService from '../services/secrets'
import * as aiProviderValidator from '../services/ai-provider-validator'
import { CIRepositoryManager } from '@worker/ci-repository-manager'
import { createLogger } from '@utils/logger'
import { reqAuthed } from '@backend/middleware/authz'
import { GITLAB_HOST, GITLAB_TOKEN, GITLAB_USER, ENCRYPTION_KEY } from '../config'

const logger = createLogger({ namespace: 'projects-handler' })

export const createProjectRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', async (c) => {
      const userId = await reqAuthed(c);
      const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
      const allProjects = await queries.findAllProjects(sql)
      const filtered = allProjects.filter(p => accessibleProjectIds.includes(p.id))
      return c.json(filtered)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      await acl.project(id).viewer.gte.throw(c)

      const project = await queries.findProjectById(sql, id)

      return c.json(project)
    })
    .get('/:id/stats', zValidator('param', idParamSchema), async (c) => {
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

      const stats = await queries.getProjectStats(sql, id)
      return c.json(stats)
    })
    .post('/', zValidator('json', createProjectSchema), requireClerkAuth(), async (c) => {
      const body = c.req.valid('json')
      const userId = await reqAuthed(c)

      const project = await queries.createProject(sql, body)

      // Grant owner access to creator
      await userAccessQueries.grantAccess(sql, {
        user_id: userId,
        entity_type: 'project',
        entity_id: project.id,
        role: 'owner',
        granted_by: userId,
      })

      // Automatically create worker repository if GitLab credentials are available
      if (GITLAB_HOST && GITLAB_TOKEN && GITLAB_USER && ENCRYPTION_KEY) {
        try {
          logger.info(`🔧 Auto-creating worker repository for project: ${project.name}`)

          // Check if worker repository already exists
          try {
            await workerRepoQueries.findWorkerRepositoryByProjectId(sql, project.id)
            logger.info(`Worker repository already exists for project ${project.id}`)
          } catch (error) {
            if (error instanceof Error && error.constructor.name === 'NotFoundException') {
              // Create worker repository in GitLab
              const manager = new CIRepositoryManager()
              const version = '2025-10-18-01'
              // Use project ID suffix to ensure uniqueness (first 8 chars of UUID)
              const projectIdShort = project.id.split('-')[0]
              const customPath = `adi-worker-${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${projectIdShort}`

              const source = await manager.createWorkerRepository({
                projectName: project.name,
                sourceType: 'gitlab',
                host: GITLAB_HOST,
                accessToken: GITLAB_TOKEN,
                user: GITLAB_USER,
                customPath,
              })

              logger.info(`✓ Created GitLab repository: ${source.project_path}`)

              // Upload CI files
              await manager.uploadCIFiles({
                source,
                version,
              })

              logger.info(`✓ Uploaded CI files (version: ${version})`)

              // Save to database
              await workerRepoQueries.createWorkerRepository(sql, {
                project_id: project.id,
                source_gitlab: source as unknown,
                current_version: version,
              })

              logger.info(`✅ Worker repository auto-created for project ${project.id}`)
            } else {
              throw error
            }
          }
        } catch (error) {
          // Log the error but don't fail project creation
          logger.error(`⚠️  Failed to auto-create worker repository for project ${project.id}:`, error)
          // Continue without failing - user can manually set up worker repo later
        }
      } else {
        const missing = []
        if (!GITLAB_HOST) missing.push('GITLAB_HOST')
        if (!GITLAB_TOKEN) missing.push('GITLAB_TOKEN')
        if (!GITLAB_USER) missing.push('GITLAB_USER')
        if (!ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY')
        logger.warn(`⚠️  Skipping worker repository auto-creation - missing env vars: ${missing.join(', ')}`)
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

      const project = await queries.updateProject(sql, id, body)

      return c.json(project)
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

      await queries.deleteProject(sql, id)

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

      const config = await queries.getProjectJobExecutor(sql, id)

      // Return config with masked token
      if (config) {
        return c.json({
          host: config.host,
          user: config.user,
          verified_at: config.verified_at,
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
        await secretQueries.findSecretById(sql, access_token_secret_id)
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

      await queries.setProjectJobExecutor(sql, id, executorConfig)

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
      if (existingConfig) {
        // Delete the secret
        await secretQueries.deleteSecret(sql, existingConfig.access_token_secret_id)
      }

      // Remove executor config
      await queries.removeProjectJobExecutor(sql, id)

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

      const configs = await queries.getProjectAIProviderConfigs(sql, id)

      if (!configs) {
        return c.json({
          anthropic: null,
          openai: null,
          google: null
        })
      }

      return c.json({
        anthropic: configs.anthropic || null,
        openai: configs.openai || null,
        google: configs.google || null
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
        await secretQueries.findSecretById(sql, configWithSecretId.api_key_secret_id)
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

      await queries.setProjectAIProviderConfig(sql, id, provider, finalConfig as any)

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
      if (providerConfig) {
        const secretId = providerConfig.api_key_secret_id
        if (secretId) {
          await secretQueries.deleteSecret(sql, secretId)
        }
      }

      await queries.removeProjectAIProviderConfig(sql, id, provider)

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
