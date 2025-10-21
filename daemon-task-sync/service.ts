/**
 * Daemon Task Sync Service
 * Fetches issues from task sources and creates tasks in the database
 * Runs as a background daemon consuming messages from RabbitMQ
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import type { TaskSource, TaskSourceIssue } from '../backend/task-sources/base'
import { createTaskSource } from '../backend/task-sources/factory'
import * as taskQueries from '../db/tasks'
import * as taskSourceQueries from '../db/task-sources'
import * as projectQueries from '../db/projects'
import * as syncStateQueries from '../db/task-source-sync-state'

const logger = createLogger({ namespace: 'daemon-task-sync' })

export interface SyncTaskSourceInput {
  taskSourceId: string
  provider: 'gitlab' | 'jira' | 'github'
}

export interface SyncTaskSourceResult {
  tasksCreated: number
  tasksUpdated: number
  errors: string[]
}

/**
 * Sync a task source: fetch all issues and create tasks
 * This is the main entry point called by the RabbitMQ consumer
 */
export async function syncTaskSource(
  sql: Sql,
  input: SyncTaskSourceInput
): Promise<SyncTaskSourceResult> {
  const { taskSourceId, provider } = input

  const result: SyncTaskSourceResult = {
    tasksCreated: 0,
    tasksUpdated: 0,
    errors: []
  }

  const syncStartTime = new Date()

  try {
    // Mark sync as started
    await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'syncing')

    // Fetch task source
    const taskSourceResult = await taskSourceQueries.findTaskSourceById(sql, taskSourceId)
    if (!taskSourceResult.ok) {
      result.errors.push(`Task source not found: ${taskSourceId}`)
      await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'failed')
      return result
    }

    const taskSource = taskSourceResult.data

    if (!taskSource.enabled) {
      result.errors.push(`Task source is disabled: ${taskSourceId}`)
      await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'failed')
      return result
    }

    // Fetch project to validate it exists and is enabled
    const projectResult = await projectQueries.findProjectById(sql, taskSource.project_id)
    if (!projectResult.ok) {
      result.errors.push(`Project not found: ${taskSource.project_id}`)
      await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'failed')
      return result
    }

    const project = projectResult.data

    if (!project.enabled) {
      result.errors.push(`Project is disabled: ${project.id}`)
      await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'failed')
      return result
    }

    // Fetch issues from task source
    logger.info(`Fetching issues from task source ${taskSource.name} (provider: ${provider})`)
    const issues = await fetchIssuesFromTaskSource(taskSource)
    logger.info(`Fetched ${issues.length} issues from ${provider} task source ${taskSource.name}`)

    // Get existing sync state to detect updates
    const existingSyncState = await syncStateQueries.findSyncStateByTaskSourceId(sql, taskSource.id)
    const existingStateMap = new Map(
      existingSyncState.map(s => [s.issue_id, s])
    )

    // Process each issue
    const syncStateUpdates: { task_source_id: string; issue_id: string; issue_updated_at: string }[] = []

    for (const issue of issues) {
      try {
        const existingState = existingStateMap.get(issue.id)
        const isNew = !existingState
        const isUpdated = existingState && existingState.issue_updated_at !== issue.updatedAt

        if (isNew || isUpdated) {
          await createTaskFromIssue(sql, {
            taskSourceId: taskSource.id,
            projectId: project.id,
            issue
          })

          if (isNew) {
            result.tasksCreated++
            logger.debug(`Created new task for issue ${issue.id}`)
          } else {
            result.tasksUpdated++
            logger.debug(`Updated task for issue ${issue.id}`)
          }
        }

        // Track this issue in sync state
        syncStateUpdates.push({
          task_source_id: taskSource.id,
          issue_id: issue.id,
          issue_updated_at: issue.updatedAt
        })
      } catch (error) {
        const errorMsg = `Failed to process issue ${issue.id}: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    // Batch update sync state
    if (syncStateUpdates.length > 0) {
      await syncStateQueries.batchUpsertSyncStates(sql, syncStateUpdates)
    }

    // Mark sync as completed
    await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'completed', syncStartTime)

    logger.info(`Sync completed for task source ${taskSource.name}: ${result.tasksCreated} created, ${result.tasksUpdated} updated`)
  } catch (error) {
    const errorMsg = `Failed to sync task source ${taskSourceId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
    await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'failed')
  }

  return result
}

/**
 * Fetch issues from a task source based on its type
 */
async function fetchIssuesFromTaskSource(taskSource: TaskSource): Promise<TaskSourceIssue[]> {
  try {
    const taskSourceInstance = createTaskSource(taskSource)
    const issuesIterable = await taskSourceInstance.getIssues()

    // Convert AsyncIterable to Array
    const issues = []
    for await (const issue of issuesIterable) {
      issues.push(issue)
    }

    return issues
  } catch (error) {
    logger.error(`Failed to fetch issues from task source ${taskSource.id} (${taskSource.type}):`, error)
    return []
  }
}

/**
 * Create a task from an issue
 */
async function createTaskFromIssue(
  sql: Sql,
  input: { taskSourceId: string; projectId: string; issue: TaskSourceIssue }
): Promise<void> {
  const { taskSourceId, projectId, issue } = input

  logger.debug(`Creating task for issue ${issue.id} from task source ${taskSourceId}`)

  await sql.begin(async (tx) => {
    const convertToBackendIssue = () => {
      if (issue.metadata.provider === 'gitlab') {
        return {
          source_gitlab_issue: {
            id: issue.id,
            iid: issue.iid,
            title: issue.title,
            updated_at: issue.updatedAt,
            metadata: issue.metadata
          }
        }
      } else if (issue.metadata.provider === 'jira') {
        return {
          source_jira_issue: {
            id: issue.id,
            title: issue.title,
            updated_at: issue.updatedAt,
            metadata: issue.metadata
          }
        }
      } else if (issue.metadata.provider === 'github') {
        return {
          source_github_issue: {
            id: issue.id,
            iid: issue.iid,
            title: issue.title,
            updated_at: issue.updatedAt,
            metadata: issue.metadata
          }
        }
      }
      return {}
    }

    const task = await taskQueries.createTask(tx, {
      title: issue.title,
      description: issue.description || undefined,
      status: 'pending',
      project_id: projectId,
      task_source_id: taskSourceId,
      ...convertToBackendIssue()
    })

    logger.info(`Created task ${task.id} for issue ${issue.id}`)
  })
}
