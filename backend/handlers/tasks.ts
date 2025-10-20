import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/tasks'
import { idParamSchema, createTaskSchema, updateTaskSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { getClerkUserId } from '../middleware/clerk'
import * as userAccessQueries from '../../db/user-access'

export const createTaskRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
      const allTasks = await queries.findAllTasks(sql)
      const filtered = allTasks.filter(t => t.project_id && accessibleProjectIds.includes(t.project_id))
      return c.json(filtered)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access
        await acl.task(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.findTaskById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createTaskSchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const task = await queries.createTask(sql, body)
      return c.json(task, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateTaskSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      try {
        // Require write access (inherits developer from project)
        await acl.task(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.updateTask(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require write access (inherits developer from project)
        await acl.task(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.deleteTask(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
