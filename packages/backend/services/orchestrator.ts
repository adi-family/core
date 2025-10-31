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

const logger = createLogger({ namespace: 'orchestrator' })

export interface SyncTaskSourceInput {
  taskSourceId: string
}

export interface SyncTaskSourceResult {
  tasksPublished: number
  errors: string[]
}

/**
 * Sync a single task source: publish task source ID to RabbitMQ queue
 * The daemon-task-sync will handle fetching issues and creating tasks
 */
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
    // Fetch task source to validate it exists and is enabled
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
      case 'gitlab_issues':
        provider = 'gitlab'
        break
      case 'jira':
        provider = 'jira'
        break
      case 'github_issues':
        provider = 'github'
        break
      default:
        // TypeScript exhaustiveness check - this should never happen
        assertNever(taskSource)
        result.errors.push(`Unsupported task source type: ${taskSource?.type}`)
        return result
    }

    // Mark as queued before publishing
    await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSource.id, 'queued')

    // Publish task source ID and provider to queue for daemon-task-sync to process
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

/**
 * Sync all enabled task sources for a project
 */
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

/**
 * Sync all enabled projects
 */
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
