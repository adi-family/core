/**
 * Task Sources API handlers
 */

import { handler, type HandlerContext } from '@adi-family/http'
import {
  listTaskSourcesConfig,
  getTaskSourceConfig,
  createTaskSourceConfig,
  updateTaskSourceConfig,
  deleteTaskSourceConfig,
  syncTaskSourceConfig
} from '@adi/api-contracts/task-sources'
import * as taskSourceQueries from '@db/task-sources'
import * as userAccessQueries from '@db/user-access'
import type { Sql } from 'postgres'
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'
import { createLogger } from '@utils/logger'
import { publishTaskSync } from '@adi/queue/publisher'

const logger = createLogger({ namespace: 'task-sources-handler' })

export function createTaskSourceHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: No Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw new Error('Unauthorized: Invalid token format')
    }

    if (!CLERK_SECRET_KEY) {
      throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
    }

    try {
      const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
      if (!payload.sub) {
        throw new Error('Unauthorized: Invalid token payload')
      }
      return payload.sub
    } catch (error) {
      logger.error('Token verification failed:', error)
      throw new Error('Unauthorized: Token verification failed')
    }
  }

  const listTaskSources = handler(listTaskSourcesConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const projectId = ctx.query?.project_id

    if (projectId) {
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this project')
      }

      return taskSourceQueries.findTaskSourcesByProjectId(sql, projectId)
    }

    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
    const allTaskSources = await taskSourceQueries.findAllTaskSources(sql)
    return allTaskSources.filter(ts => accessibleProjectIds.includes(ts.project_id))
  })

  const getTaskSource = handler(getTaskSourceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, taskSource.project_id)
    if (!hasAccess) {
      throw new Error('Forbidden: You do not have access to this task source')
    }

    return taskSource
  })

  const createTaskSource = handler(createTaskSourceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { project_id } = ctx.body as any

    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You need admin role to create task sources for this project')
    }

    const taskSource = await taskSourceQueries.createTaskSource(sql, ctx.body as any)

    const provider = taskSource.type === 'gitlab_issues' ? 'gitlab' : taskSource.type === 'github_issues' ? 'github' : 'jira'
    await publishTaskSync({ taskSourceId: taskSource.id, provider })
    logger.info(`Triggered immediate sync for newly created task source ${taskSource.id}`)

    return taskSource
  })

  const updateTaskSource = handler(updateTaskSourceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, taskSource.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You need admin role to update this task source')
    }

    return taskSourceQueries.updateTaskSource(sql, id, ctx.body as any)
  })

  const deleteTaskSource = handler(deleteTaskSourceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, taskSource.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You need admin role to delete this task source')
    }

    await taskSourceQueries.deleteTaskSource(sql, id)
    return { success: true }
  })

  const syncTaskSource = handler(syncTaskSourceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, taskSource.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You need admin role to sync this task source')
    }

    // Queue sync job via RabbitMQ
    const provider = taskSource.type === 'gitlab_issues' ? 'gitlab' : taskSource.type === 'github_issues' ? 'github' : 'jira'
    await publishTaskSync({ taskSourceId: id, provider })
    logger.info(`Manually triggered sync for task source ${id}`)

    return {
      success: true,
      message: `Task source ${id} sync queued successfully`
    }
  })

  return {
    listTaskSources,
    getTaskSource,
    createTaskSource,
    updateTaskSource,
    deleteTaskSource,
    syncTaskSource,
  }
}
