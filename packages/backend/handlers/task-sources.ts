import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/task-sources'
import { createLogger } from '@utils/logger.ts'
import { syncTaskSource } from '../services/orchestrator'
import { idParamSchema, createTaskSourceSchema, updateTaskSourceSchema, projectIdQuerySchema } from '../schemas'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { reqAuthed } from '../middleware/authz'
import * as userAccessQueries from '../../db/user-access'
import { getProjectOwnerId } from '../../db/user-access'
import { selectAIProviderForEvaluation, QuotaExceededError } from '../services/ai-provider-selector'

const logger = createLogger({ namespace: 'task-sources' })

export const createTaskSourceRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', zValidator('query', projectIdQuerySchema), async (c) => {
      const { project_id } = c.req.valid('query')
      const userId = await reqAuthed(c)

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

      const taskSource = await queries.findTaskSourceById(sql, id)

      return c.json(taskSource)
    })
    .post('/', zValidator('json', createTaskSourceSchema), async (c) => {
      const body = c.req.valid('json')
      const userId = await reqAuthed(c)

      try {
        // Require developer access to project
        await acl.project(body.project_id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const taskSource = await queries.createTaskSource(sql, body as import('../../types').CreateTaskSourceInput)

      // Grant write access to creator
      await userAccessQueries.grantAccess(sql, {
        user_id: userId,
        entity_type: 'task_source',
        entity_id: taskSource.id,
        role: 'write',
        granted_by: userId,
      })

      // Automatically trigger initial sync for newly created task source
      // Sync will fetch issues and auto-queue evaluations for new tasks
      logger.info(`🔄 Triggering initial sync for newly created task source ${taskSource.id}`)

      let syncTriggered = false
      let syncMessage: string | undefined

      try {
        const ownerId = await getProjectOwnerId(sql, taskSource.project_id)

        if (!ownerId) {
          syncMessage = 'No project owner found - sync skipped'
          logger.warn(`No project owner found for task source ${taskSource.id}, skipping automatic sync`)
        } else {
          // Check quota before syncing (sync auto-queues evaluations)
          try {
            await selectAIProviderForEvaluation(sql, ownerId, taskSource.project_id, 'simple')

            // Quota available - trigger sync
            const syncResult = await syncTaskSource(sql, {
              taskSourceId: taskSource.id
            })

            if (syncResult.errors.length > 0) {
              syncMessage = `Sync queued with warnings: ${syncResult.errors.join(', ')}`
              logger.warn(`Sync queued for ${taskSource.id} but had errors:`, syncResult.errors)
            } else {
              syncTriggered = true
              syncMessage = 'Initial sync queued successfully'
              logger.info(`✅ Successfully queued initial sync for task source ${taskSource.id}`)
            }
          } catch (quotaError) {
            if (quotaError instanceof QuotaExceededError) {
              syncMessage = 'Sync skipped - evaluation quota exceeded'
              logger.warn(`Skipping automatic sync for task source ${taskSource.id}: ${quotaError.message}`)
            } else {
              throw quotaError
            }
          }
        }
      } catch (error) {
        syncMessage = `Sync failed: ${error instanceof Error ? error.message : String(error)}`
        logger.error(`Failed to enqueue sync for task source ${taskSource.id}:`, error)
        // Don't fail the creation if sync enqueue fails
      }

      return c.json({
        ...taskSource,
        _meta: {
          sync_triggered: syncTriggered,
          sync_message: syncMessage
        }
      }, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateTaskSourceSchema), async (c) => {
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

      const taskSource = await queries.updateTaskSource(sql, id, body as import('../../types').UpdateTaskSourceInput)

      return c.json(taskSource)
    })
    .delete('/:id', zValidator('param', idParamSchema), async (c) => {
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

      await queries.deleteTaskSource(sql, id)

      return c.json({ success: true })
    })
    .post('/:id/sync', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require write access to sync
        await acl.taskSource(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const taskSource = await queries.findTaskSourceById(sql, id)

      // Check quota before syncing (sync automatically queues evaluations for new tasks)
      const userId = await getProjectOwnerId(sql, taskSource.project_id)

      if (!userId) {
        return c.json({ error: 'No project owner found' }, 400)
      }

      // Check if user has quota available for simple evaluation
      // Sync will auto-queue evaluations for new tasks, so we verify quota exists
      try {
        await selectAIProviderForEvaluation(sql, userId, taskSource.project_id, 'simple')
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          return c.json({
            error: `${error.message} Sync creates tasks that are automatically queued for evaluation.`
          }, 429)
        }
        throw error
      }

      // Trigger orchestrator to fetch issues and publish to RabbitMQ
      logger.info(`Sync requested for task source ${id}`)

      try {
        const syncResult = await syncTaskSource(sql, {
          taskSourceId: id
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
