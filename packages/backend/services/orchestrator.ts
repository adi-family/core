/**
 * Task Orchestrator Service
 * Publishes task source sync requests to RabbitMQ queue
 */

import type { Sql } from 'postgres'
import type { TaskSource } from '@types'
import { createLogger } from '@utils/logger'
import * as taskSourceQueries from '@db/task-sources'
import * as projectQueries from '@db/projects'
import { publishTaskSync } from '@adi/queue/publisher'
import { assertNever } from "@utils/assert-never";
import { TASK_STATUS, TASK_SOURCE_TYPES } from '@config/shared'

const logger = createLogger({ namespace: 'orchestrator' })

export interface SyncTaskSourceInput {
  taskSourceId: string
}

export interface SyncTaskSourceResult {
  tasksPublished: number
  errors: string[]
}

export async function syncTaskSource(
  sql: Sql,
  input: SyncTaskSourceInput
): Promise<SyncTaskSourceResult> {
  const { taskSourceId } = input

  const result: SyncTaskSourceResult = {
    tasksPublished: 0,
    errors: []
  }

  try {
    let taskSource: TaskSource
    try {
      taskSource = await taskSourceQueries.findTaskSourceById(sql, taskSourceId)
    } catch {
      result.errors.push(`Task source not found: ${taskSourceId}`)
      return result
    }

    if (!taskSource.enabled) {
      result.errors.push(`Task source is disabled: ${taskSourceId}`)
      return result
    }

    // Extract provider from task source type
    let provider: 'gitlab' | 'jira' | 'github'
    switch (taskSource.type) {
      case TASK_SOURCE_TYPES[0]: // 'gitlab_issues'
        provider = 'gitlab'
        break
      case TASK_SOURCE_TYPES[2]: // 'jira'
        provider = 'jira'
        break
      case TASK_SOURCE_TYPES[1]: // 'github_issues'
        provider = 'github'
        break
      case 'manual':
        // Manual task sources don't need syncing, return early
        result.errors.push('Manual task sources do not require syncing')
        return result
      default:
        assertNever(taskSource)
        result.errors.push(`Unsupported task source type: ${taskSource?.type}`)
        return result
    }

    await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSource.id, TASK_STATUS.sync[1])

    await publishTaskSync({
      taskSourceId: taskSource.id,
      provider
    })

    result.tasksPublished = 1
    logger.info(`Published task source ${taskSource.id} (${provider}) to sync queue`)
  } catch (error) {
    const errorMsg = `Failed to publish task source ${taskSourceId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
  }

  return result
}

export async function syncProjectTaskSources(
  sql: Sql,
  projectId: string
): Promise<SyncTaskSourceResult> {
  const taskSources = await taskSourceQueries.findTaskSourcesByProjectId(sql, projectId)

  const combinedResult: SyncTaskSourceResult = {
    tasksPublished: 0,
    errors: []
  }

  for (const taskSource of taskSources) {
    if (!taskSource.enabled) {
      continue
    }

    const result = await syncTaskSource(sql, {
      taskSourceId: taskSource.id
    })

    combinedResult.tasksPublished += result.tasksPublished
    combinedResult.errors.push(...result.errors)
  }

  return combinedResult
}

export async function syncAllProjects(
  sql: Sql
): Promise<SyncTaskSourceResult> {
  const projects = await projectQueries.findAllProjects(sql)

  const combinedResult: SyncTaskSourceResult = {
    tasksPublished: 0,
    errors: []
  }

  for (const project of projects) {
    if (!project.enabled) {
      continue
    }

    const result = await syncProjectTaskSources(sql, project.id)

    combinedResult.tasksPublished += result.tasksPublished
    combinedResult.errors.push(...result.errors)
  }

  return combinedResult
}
