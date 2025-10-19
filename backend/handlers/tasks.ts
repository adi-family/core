import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/tasks'
import { idParamSchema, createTaskSchema, updateTaskSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'

export const createTaskRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const tasks = await queries.findAllTasks(sql)
      return c.json(tasks)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
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
      const result = await queries.updateTask(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.deleteTask(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
