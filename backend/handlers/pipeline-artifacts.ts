import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../../db/pipeline-artifacts'

export const createPipelineArtifactHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const artifacts = await queries.findAllPipelineArtifacts(sql)
    return c.json(artifacts)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findPipelineArtifactById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  getByExecutionId: async (c: Context) => {
    const executionId = c.req.param('executionId')
    const artifacts = await queries.findPipelineArtifactsByExecutionId(sql, executionId)
    return c.json(artifacts)
  },

  create: async (c: Context) => {
    const executionId = c.req.param('executionId')
    const body = await c.req.json()

    // Ensure execution ID from URL is used
    const artifactData = {
      ...body,
      pipeline_execution_id: executionId
    }

    const artifact = await queries.createPipelineArtifact(sql, artifactData)
    return c.json(artifact, 201)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deletePipelineArtifact(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true })
  }
})
