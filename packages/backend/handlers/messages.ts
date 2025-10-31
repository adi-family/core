import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/messages'
import { idParamSchema, createMessageSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'

export const createMessageRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const messages = await queries.findAllMessages(sql)
      return c.json(messages)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const message = await queries.findMessageById(sql, id)
      return c.json(message)
    })
    .post('/', zValidator('json', createMessageSchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const message = await queries.createMessage(sql, body)
      return c.json(message, 201)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      await queries.deleteMessage(sql, id)
      return c.json({ success: true })
    });
}
