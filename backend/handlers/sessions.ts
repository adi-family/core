import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/sessions'
import { idParamSchema, createSessionSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'

export const createSessionRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const sessions = await queries.findAllSessions(sql)
      return c.json(sessions)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.findSessionById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createSessionSchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const session = await queries.createSession(sql, body)
      return c.json(session, 201)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.deleteSession(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
