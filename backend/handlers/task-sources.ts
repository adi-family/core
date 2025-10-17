import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../../db/task-sources'

export const createTaskSourceHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const projectId = c.req.query('project_id')

    if (projectId) {
      const taskSources = await queries.findTaskSourcesByProjectId(sql, projectId)
      return c.json(taskSources)
    }

    const taskSources = await queries.findAllTaskSources(sql)
    return c.json(taskSources)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findTaskSourceById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const taskSource = await queries.createTaskSource(sql, body)
    return c.json(taskSource, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await queries.updateTaskSource(sql, id, body)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteTaskSource(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true })
  }
})
