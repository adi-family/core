import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../../db/projects'

export const createProjectHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const projects = await queries.findAllProjects(sql)
    return c.json(projects)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findProjectById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const project = await queries.createProject(sql, body)
    return c.json(project, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await queries.updateProject(sql, id, body)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteProject(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true })
  }
})
