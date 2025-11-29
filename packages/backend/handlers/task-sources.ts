/**
 * Task Sources API handlers
 */

import {
  listTaskSourcesConfig,
  getTaskSourceConfig,
  createTaskSourceConfig,
  updateTaskSourceConfig,
  deleteTaskSourceConfig,
  syncTaskSourceConfig
} from '@adi/api-contracts/task-sources'
import * as taskSourceQueries from '@db/task-sources'
import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import { publishTaskSync } from '@adi/queue/publisher'
import { createSecuredHandlers } from '../utils/auth'

const logger = createLogger({ namespace: 'task-sources-handler' })

export function createTaskSourceHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  const listTaskSources = handler(listTaskSourcesConfig, async (ctx) => {
    const projectId = ctx.query?.project_id

    if (projectId) {
      await ctx.acl.project(projectId).viewer()
      return taskSourceQueries.findTaskSourcesByProjectId(sql, projectId)
    }

    const accessibleProjectIds = await ctx.acl.accessibleProjectIds()
    const allTaskSources = await taskSourceQueries.findAllTaskSources(sql)
    return allTaskSources.filter(ts => accessibleProjectIds.includes(ts.project_id))
  })

  const getTaskSource = handler(getTaskSourceConfig, async (ctx) => {
    const { id } = ctx.params
    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    await ctx.acl.project(taskSource.project_id).viewer()
    return taskSource
  })

  const createTaskSource = handler(createTaskSourceConfig, async (ctx) => {
    const { project_id } = ctx.body as any
    await ctx.acl.project(project_id).admin()

    const taskSource = await taskSourceQueries.createTaskSource(sql, ctx.body as any)

    const provider = taskSource.type === 'gitlab_issues' ? 'gitlab' : taskSource.type === 'github_issues' ? 'github' : 'jira'
    await publishTaskSync({ taskSourceId: taskSource.id, provider })
    logger.info(`Triggered immediate sync for newly created task source ${taskSource.id}`)

    return taskSource
  })

  const updateTaskSource = handler(updateTaskSourceConfig, async (ctx) => {
    const { id } = ctx.params
    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    await ctx.acl.project(taskSource.project_id).admin()
    return taskSourceQueries.updateTaskSource(sql, id, ctx.body as any)
  })

  const deleteTaskSource = handler(deleteTaskSourceConfig, async (ctx) => {
    const { id } = ctx.params
    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    await ctx.acl.project(taskSource.project_id).admin()
    await taskSourceQueries.deleteTaskSource(sql, id)
    return { success: true }
  })

  const syncTaskSource = handler(syncTaskSourceConfig, async (ctx) => {
    const { id } = ctx.params
    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    await ctx.acl.project(taskSource.project_id).admin()

    const provider = taskSource.type === 'gitlab_issues' ? 'gitlab' : taskSource.type === 'github_issues' ? 'github' : 'jira'
    await publishTaskSync({ taskSourceId: id, provider })
    logger.info(`Manually triggered sync for task source ${id}`)

    return { success: true, message: `Task source ${id} sync queued successfully` }
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
