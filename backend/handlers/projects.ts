import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/projects'
import * as userAccessQueries from '../../db/user-access'
import { idParamSchema, createProjectSchema, updateProjectSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'
import { getClerkUserId } from '../middleware/clerk'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'

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
    .post('/', zValidator('json', createProjectSchema), authMiddleware, async (c) => {
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
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateProjectSchema), authMiddleware, async (c) => {
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
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
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
}
