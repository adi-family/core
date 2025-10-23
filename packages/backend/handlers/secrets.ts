import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/secrets'
import { z } from 'zod'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { getClerkUserId, requireClerkAuth } from '../middleware/clerk'
import * as userAccessQueries from '../../db/user-access'
import * as secretsService from '../services/secrets'

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

export const createSecretRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

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

      const result = await queries.findSecretById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      const sanitized = secretsService.sanitizeSecretForResponse(result.data)
      return c.json(sanitized)
    })
    .post('/', zValidator('json', createSecretSchema), requireClerkAuth(), async (c) => {
      const body = c.req.valid('json')
      const userId = getClerkUserId(c)

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

      const result = await queries.deleteSecret(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
