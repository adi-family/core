import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../../db/pipeline-executions'

export const createPipelineExecutionHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const executions = await queries.findAllPipelineExecutions(sql)
    return c.json(executions)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findPipelineExecutionById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  getBySessionId: async (c: Context) => {
    const sessionId = c.req.param('sessionId')
    const executions = await queries.findPipelineExecutionsBySessionId(sql, sessionId)
    return c.json(executions)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const execution = await queries.createPipelineExecution(sql, body)
    return c.json(execution, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await queries.updatePipelineExecution(sql, id, body)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deletePipelineExecution(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true })
  },

  listStale: async (c: Context) => {
    const timeoutMinutes = parseInt(c.req.query('timeoutMinutes') || '30')
    const executions = await queries.findStalePipelineExecutions(sql, timeoutMinutes)
    return c.json(executions)
  }
})
