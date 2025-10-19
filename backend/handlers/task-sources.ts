import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/task-sources'
import { createLogger } from '@utils/logger.ts'
import { processTaskSource } from '../services/orchestrator'
import { idParamSchema, createTaskSourceSchema, updateTaskSourceSchema, projectIdQuerySchema } from '../schemas'

const logger = createLogger({ namespace: 'task-sources' })

export const createTaskSourceRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', zValidator('query', projectIdQuerySchema), async (c) => {
      const { project_id } = c.req.valid('query')

      if (project_id) {
        const taskSources = await queries.findTaskSourcesByProjectId(sql, project_id)
        return c.json(taskSources)
      }

      const taskSources = await queries.findAllTaskSources(sql)
      return c.json(taskSources)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.findTaskSourceById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createTaskSourceSchema), async (c) => {
      const body = c.req.valid('json')
      const taskSource = await queries.createTaskSource(sql, body)
      return c.json(taskSource, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateTaskSourceSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const result = await queries.updateTaskSource(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.deleteTaskSource(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    .post('/:id/sync', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.findTaskSourceById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      // Trigger orchestrator to fetch and process issues from this task source
      logger.info(`Sync requested for task source ${id}`)

      try {
        const syncResult = await processTaskSource(sql, {
          taskSourceId: id,
          runner: 'claude' // TODO: Make configurable via query param or body
        })

        return c.json({
          success: true,
          ...syncResult
        })
      } catch (error) {
        logger.error(`Sync failed for task source ${id}:`, error)
        return c.json({
          error: error instanceof Error ? error.message : 'Sync failed'
        }, 500)
      }
    })
}
