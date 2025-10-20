import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/task-sources'
import { createLogger } from '@utils/logger.ts'
import { processTaskSource } from '../services/orchestrator'
import { idParamSchema, createTaskSourceSchema, updateTaskSourceSchema, projectIdQuerySchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { getClerkUserId } from '../middleware/clerk'
import * as userAccessQueries from '../../db/user-access'

const logger = createLogger({ namespace: 'task-sources' })

export const createTaskSourceRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', zValidator('query', projectIdQuerySchema), async (c) => {
      const { project_id } = c.req.valid('query')
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      if (project_id) {
        const hasAccess = await acl.project(project_id).viewer.gte.check(c)
        if (!hasAccess) {
          return c.json({ error: 'Insufficient permissions' }, 403)
        }

        const taskSources = await queries.findTaskSourcesByProjectId(sql, project_id)
        return c.json(taskSources)
      }

      const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
      const allTaskSources = await queries.findAllTaskSources(sql)
      const filtered = allTaskSources.filter(ts => accessibleProjectIds.includes(ts.project_id))
      return c.json(filtered)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access
        await acl.taskSource(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.findTaskSourceById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createTaskSourceSchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const userId = getClerkUserId(c)

      try {
        // Require developer access to project
        await acl.project(body.project_id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const taskSource = await queries.createTaskSource(sql, body)

      // Grant write access to creator
      if (userId) {
        await userAccessQueries.grantAccess(sql, {
          user_id: userId,
          entity_type: 'task_source',
          entity_id: taskSource.id,
          role: 'write',
          granted_by: userId,
        })
      }

      return c.json(taskSource, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateTaskSourceSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      try {
        // Require write access
        await acl.taskSource(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.updateTaskSource(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require write access
        await acl.taskSource(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.deleteTaskSource(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    .post('/:id/sync', zValidator('param', idParamSchema), authMiddleware, async (c) => {
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
