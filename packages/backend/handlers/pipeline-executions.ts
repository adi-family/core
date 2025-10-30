import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/pipeline-executions'
import { idParamSchema, sessionIdParamSchema, createPipelineExecutionSchema, updatePipelineExecutionSchema, timeoutQuerySchema, saveApiUsageSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'
import * as apiUsageMetricsQueries from '../../db/api-usage-metrics'

export const createPipelineExecutionRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const executions = await queries.findAllPipelineExecutions(sql)
      return c.json(executions)
    })
    .get('/stale', zValidator('query', timeoutQuerySchema.partial()), async (c) => {
      const query = c.req.valid('query')
      const timeoutMinutes = query.timeoutMinutes ?? 30
      const executions = await queries.findStalePipelineExecutions(sql, timeoutMinutes)
      return c.json(executions)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const execution = await queries.findPipelineExecutionById(sql, id)
      return c.json(execution)
    })
    .post('/', zValidator('json', createPipelineExecutionSchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const execution = await queries.createPipelineExecution(sql, body)
      return c.json(execution, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updatePipelineExecutionSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const execution = await queries.updatePipelineExecution(sql, id, body)
      return c.json(execution)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      await queries.deletePipelineExecution(sql, id)
      return c.json({ success: true })
    })
    // Note: This route needs special handling in app.ts since it uses /sessions/:sessionId prefix
    .get('/by-session/:sessionId', zValidator('param', sessionIdParamSchema), async (c) => {
      const { sessionId } = c.req.valid('param')
      const executions = await queries.findPipelineExecutionsBySessionId(sql, sessionId)
      return c.json(executions)
    })
    .post('/:id/usage', zValidator('param', idParamSchema), zValidator('json', saveApiUsageSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const usage = c.req.valid('json')

      await apiUsageMetricsQueries.createApiUsageMetric(sql, {
        pipeline_execution_id: id,
        session_id: usage.session_id,
        task_id: usage.task_id,
        provider: usage.provider,
        model: usage.model,
        goal: usage.goal,
        phase: usage.phase,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
        ci_duration_seconds: usage.ci_duration_seconds,
        iteration_number: usage.iteration_number ?? null,
        metadata: usage.metadata ?? null,
      })

      return c.json({ success: true }, 201)
    })
}
