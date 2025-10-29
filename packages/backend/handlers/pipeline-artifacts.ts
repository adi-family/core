import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/pipeline-artifacts'
import { idParamSchema, executionIdParamSchema, createPipelineArtifactSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'

export const createPipelineArtifactRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const artifacts = await queries.findAllPipelineArtifacts(sql)
      return c.json(artifacts)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.findPipelineArtifactById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.deletePipelineArtifact(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    .get('/by-execution/:executionId', zValidator('param', executionIdParamSchema), async (c) => {
      const { executionId } = c.req.valid('param')
      const artifacts = await queries.findPipelineArtifactsByExecutionId(sql, executionId)
      return c.json(artifacts)
    })
    // Note: This route needs special handling in app.ts since it uses /pipeline-executions/:executionId prefix
    .post('/by-execution/:executionId', zValidator('param', executionIdParamSchema), zValidator('json', createPipelineArtifactSchema), async (c) => {
      const { executionId } = c.req.valid('param')
      const body = c.req.valid('json')

      // Ensure execution ID from URL is used
      const artifactData = {
        ...body,
        pipeline_execution_id: executionId
      }

      const artifact = await queries.createPipelineArtifact(sql, artifactData)
      return c.json(artifact, 201)
    })
}
