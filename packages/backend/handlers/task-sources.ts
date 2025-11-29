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
import { createTaskSourceInputSchema, updateTaskSourceInputSchema } from '@adi-simple/types'
import { assertNever } from '@utils/assert-never'
import type { TaskSource } from '@adi-simple/types'

const logger = createLogger({ namespace: 'task-sources-handler' })

const getProviderFromTaskSource = (type: TaskSource['type']): 'gitlab' | 'github' | 'jira' => {
  switch (type) {
    case 'gitlab_issues': return 'gitlab'
    case 'github_issues': return 'github'
    case 'jira': return 'jira'
    case 'manual': throw new Error('Manual task sources cannot be synced')
    default: return assertNever(type)
  }
}

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
    const input = createTaskSourceInputSchema.parse(ctx.body)
    await ctx.acl.project(input.project_id).admin()

    const taskSource = await taskSourceQueries.createTaskSource(sql, input)

    await publishTaskSync({ taskSourceId: taskSource.id, provider: getProviderFromTaskSource(taskSource.type) })
    logger.info(`Triggered immediate sync for newly created task source ${taskSource.id}`)

    return taskSource
  })

  const updateTaskSource = handler(updateTaskSourceConfig, async (ctx) => {
    const { id } = ctx.params
    const taskSource = await taskSourceQueries.findTaskSourceById(sql, id)
    await ctx.acl.project(taskSource.project_id).admin()
    const input = updateTaskSourceInputSchema.parse(ctx.body)
    return taskSourceQueries.updateTaskSource(sql, id, input)
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

    await publishTaskSync({ taskSourceId: id, provider: getProviderFromTaskSource(taskSource.type) })
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
