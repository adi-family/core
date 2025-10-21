import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/projects'
import * as secretQueries from '../../db/secrets'
import * as userAccessQueries from '../../db/user-access'
import { idParamSchema, createProjectSchema, updateProjectSchema, setJobExecutorSchema } from '../schemas'
import { getClerkUserId, requireClerkAuth } from '../middleware/clerk'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { verifyGitLabExecutor } from '../services/gitlab-executor-verifier'

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
      const { host, access_token } = c.req.valid('json')

      try {
        await acl.project(id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Verify the GitLab executor
      const verificationResult = await verifyGitLabExecutor({ host, access_token })

      if (!verificationResult.valid) {
        return c.json({
          error: 'GitLab executor verification failed',
          details: verificationResult.error
        }, 400)
      }

      // Create secret for access token
      const secret = await secretQueries.createSecret(sql, {
        project_id: id,
        name: `gitlab-executor-token-${id}`,
        value: access_token,
        description: `GitLab executor token for ${host}`
      })

      // Set executor configuration
      const executorConfig = {
        host,
        access_token_secret_id: secret.id,
        verified_at: new Date().toISOString(),
        user: verificationResult.user
      }

      const result = await queries.setProjectJobExecutor(sql, id, executorConfig)

      if (!result.ok) {
        // Cleanup secret if project update failed
        await secretQueries.deleteSecret(sql, secret.id)
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
}
