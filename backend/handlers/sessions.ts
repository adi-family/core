import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../queries/sessions'

export const createSessionHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const sessions = await queries.findAllSessions(sql)
    return c.json(sessions)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findSessionById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  listByTask: async (c: Context) => {
    const taskId = c.req.param('taskId')
    const sessions = await queries.findSessionsByTaskId(sql, taskId)
    return c.json(sessions)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const session = await queries.createSession(sql, body)
    return c.json(session, 201)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteSession(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true }, 204)
  }
})
