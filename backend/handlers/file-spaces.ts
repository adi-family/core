import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../../db/file-spaces'

export const createFileSpaceHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const projectId = c.req.query('project_id')

    if (projectId) {
      const fileSpaces = await queries.findFileSpacesByProjectId(sql, projectId)
      return c.json(fileSpaces)
    }

    const fileSpaces = await queries.findAllFileSpaces(sql)
    return c.json(fileSpaces)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findFileSpaceById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const fileSpace = await queries.createFileSpace(sql, body)
    return c.json(fileSpace, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await queries.updateFileSpace(sql, id, body)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteFileSpace(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true })
  }
})
