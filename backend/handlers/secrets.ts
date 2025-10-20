import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/secrets'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { getClerkUserId } from '../middleware/clerk'
import * as userAccessQueries from '../../db/user-access'

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

      // If authenticated, filter secrets by project access
      if (userId) {
        const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
        const allSecrets = await queries.findAllSecrets(sql)
        const filtered = allSecrets.filter(s => accessibleProjectIds.includes(s.project_id))
        return c.json(filtered)
      }

      // Backward compatibility - return all
      const secrets = await queries.findAllSecrets(sql)
      return c.json(secrets)
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
      return c.json(secrets)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      // Check secret read access
      await acl.secret(id).read.orNull(c)

      const result = await queries.findSecretById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createSecretSchema), authMiddleware, async (c) => {
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

      const secret = await queries.createSecret(sql, body)

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

      return c.json(secret, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateSecretSchema), authMiddleware, async (c) => {
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

      const result = await queries.updateSecret(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
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
