import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../queries/tasks'

export const createTaskHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const tasks = await queries.findAllTasks(sql)()
    return c.json(tasks)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findTaskById(sql)(id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const task = await queries.createTask(sql)(body)
    return c.json(task, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await queries.updateTask(sql)(id, body)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteTask(sql)(id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true }, 204)
  }
})
