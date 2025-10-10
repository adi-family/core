import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../queries/messages'

export const createMessageHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const messages = await queries.findAllMessages(sql)()
    return c.json(messages)
  },

  listBySession: async (c: Context) => {
    const sessionId = c.req.param('sessionId')
    const messages = await queries.findMessagesBySessionId(sql)(sessionId)
    return c.json(messages)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findMessageById(sql)(id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const message = await queries.createMessage(sql)(body)
    return c.json(message, 201)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteMessage(sql)(id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true }, 204)
  }
})
