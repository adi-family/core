import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../../db/worker-repositories'

export const createWorkerRepositoryHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const repos = await queries.findAllWorkerRepositories(sql)
    return c.json(repos)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findWorkerRepositoryById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  getByProjectId: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const result = await queries.findWorkerRepositoryByProjectId(sql, projectId)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const repo = await queries.createWorkerRepository(sql, body)
    return c.json(repo, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await queries.updateWorkerRepository(sql, id, body)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteWorkerRepository(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true })
  }
})
