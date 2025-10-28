/**
 * Daemon Task Sync Service
 * Fetches issues from task sources and creates tasks in the database
 * Runs as a background daemon consuming messages from RabbitMQ
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import { createTaskSource } from '@backend/task-sources/factory'
import * as taskQueries from '@db/tasks'
import * as taskSourceQueries from '@db/task-sources'
import * as projectQueries from '@db/projects'
import * as syncStateQueries from '@db/task-source-sync-state'
import {assertNever} from "@utils/assert-never.ts";
import type {TaskSource, TaskSourceIssue, CreateTaskInput, Task} from "@types";
import { publishTaskEval } from '@queue/publisher'

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
          const task = await createTaskFromIssue(sql, {
            taskSourceId: taskSource.id,
            projectId: project.id,
            issue
          })

          if (isNew) {
            result.tasksCreated++
            logger.debug(`Created new task for issue ${issue.id}`)

            // Queue evaluation for newly created tasks (check quota first)
            if (task.ai_evaluation_status === 'pending') {
              try {
                // Check quota before auto-queueing evaluation
                const { getProjectOwnerId } = await import('@db/user-access')
                const userId = await getProjectOwnerId(sql, project.id)

                if (userId) {
                  const { selectAIProviderForEvaluation, QuotaExceededError } = await import('@backend/services/ai-provider-selector')
                  try {
                    await selectAIProviderForEvaluation(sql, userId, project.id, 'simple')

                    // Quota available - queue evaluation
                    await publishTaskEval({ taskId: task.id })
                    logger.debug(`Queued evaluation for new task ${task.id}`)
                  } catch (quotaError) {
                    if (quotaError instanceof QuotaExceededError) {
                      logger.warn(`Skipping auto-evaluation for task ${task.id}: ${quotaError.message}`)
                    } else {
                      throw quotaError
                    }
                  }
                } else {
                  logger.warn(`No project owner found for project ${project.id}, skipping auto-evaluation for task ${task.id}`)
                }
              } catch (evalError) {
                logger.error(`Failed to queue evaluation for task ${task.id}:`, evalError)
              }
            }
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

    // Revalidate existing tasks to detect closed issues
    try {
      logger.info(`Starting revalidation for task source ${taskSource.name}`)
      const revalidationResult = await revalidateTasksStatus(sql, input)
      logger.info(`Revalidation completed: ${revalidationResult.tasksUpdated} tasks updated`)
      if (revalidationResult.errors.length > 0) {
        result.errors.push(...revalidationResult.errors)
      }
    } catch (revalidationError) {
      const errorMsg = `Revalidation failed: ${revalidationError instanceof Error ? revalidationError.message : String(revalidationError)}`
      logger.error(errorMsg)
      result.errors.push(errorMsg)
    }
  } catch (error) {
    const errorMsg = `Failed to sync task source ${taskSourceId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
    await taskSourceQueries.updateTaskSourceSyncStatus(sql, taskSourceId, 'failed')
  }

  return result
}

/**
 * Revalidate existing tasks - check if issues have been closed on remote
 * This is called after the main sync to update task statuses
 */
export async function revalidateTasksStatus(
  sql: Sql,
  input: SyncTaskSourceInput
): Promise<{ tasksUpdated: number; errors: string[] }> {
  const { taskSourceId } = input
  const result: { tasksUpdated: number; errors: string[] } = {
    tasksUpdated: 0,
    errors: []
  }

  try {
    // Fetch task source
    const taskSourceResult = await taskSourceQueries.findTaskSourceById(sql, taskSourceId)
    if (!taskSourceResult.ok) {
      result.errors.push(`Task source not found: ${taskSourceId}`)
      return result
    }

    const taskSource = taskSourceResult.data

    // Only GitLab and GitHub sources support revalidation for now
    if (taskSource.type !== 'gitlab_issues') {
      logger.debug(`Revalidation not supported for task source type: ${taskSource.type}`)
      return result
    }

    // Get all tasks for this task source
    const allTasks = await sql<Task[]>`
      SELECT * FROM tasks
      WHERE task_source_id = ${taskSourceId}
    `

    if (allTasks.length === 0) {
      logger.debug(`No tasks found for task source ${taskSourceId}`)
      return result
    }

    // Extract IIDs from GitLab tasks
    const iids: number[] = []
    for (const task of allTasks) {
      if (task.source_gitlab_issue?.iid) {
        iids.push(task.source_gitlab_issue.iid)
      }
    }

    if (iids.length === 0) {
      logger.debug(`No GitLab issue IIDs found for revalidation`)
      return result
    }

    logger.info(`Revalidating ${iids.length} issues for task source ${taskSource.name}`)

    // Fetch current status from GitLab
    const taskSourceInstance = createTaskSource(taskSource)
    if (!taskSourceInstance.revalidateIssues) {
      logger.warn(`Task source does not support revalidation: ${taskSource.type}`)
      return result
    }

    const issuesIterable = taskSourceInstance.revalidateIssues(iids)
    const issueStatusMap = new Map<string, 'opened' | 'closed'>()

    for await (const issue of issuesIterable) {
      if (issue.state) {
        issueStatusMap.set(issue.id, issue.state)
      }
    }

    // Update tasks whose remote status has changed
    for (const task of allTasks) {
      const issueId = task.source_gitlab_issue?.id
      if (!issueId) continue

      const currentRemoteStatus = issueStatusMap.get(issueId)
      if (!currentRemoteStatus) {
        // Issue not found in revalidation - might be deleted
        logger.debug(`Issue ${issueId} not found during revalidation`)
        continue
      }

      if (task.remote_status !== currentRemoteStatus) {
        // Status has changed - update the task
        try {
          await taskQueries.updateTask(sql, task.id, {
            remote_status: currentRemoteStatus
          })
          result.tasksUpdated++
          logger.info(`Updated task ${task.id} remote_status: ${task.remote_status} -> ${currentRemoteStatus}`)
        } catch (error) {
          const errorMsg = `Failed to update task ${task.id}: ${error instanceof Error ? error.message : String(error)}`
          logger.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }
    }

    logger.info(`Revalidation completed: ${result.tasksUpdated} tasks updated`)
  } catch (error) {
    const errorMsg = `Failed to revalidate tasks for source ${taskSourceId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
  }

  return result
}

/**
 * Fetch issues from a task source based on its type
 */
async function fetchIssuesFromTaskSource(taskSource: TaskSource): Promise<TaskSourceIssue[]> {
  try {
    const taskSourceInstance = createTaskSource(taskSource)
    const issuesIterable = taskSourceInstance.getIssues()

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
 * Helper to remove undefined values from an object (recursively)
 * Postgres doesn't accept undefined values - they must be null or omitted
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key in obj) {
    const value = obj[key]
    if (value !== undefined) {
      // Recursively clean nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = removeUndefined(value as Record<string, unknown>) as T[Extract<keyof T, string>]
      } else {
        result[key] = value
      }
    }
  }
  return result
}

/**
 * Create a task from an issue
 */
async function createTaskFromIssue(
  sql: Sql,
  input: { taskSourceId: string; projectId: string; issue: TaskSourceIssue }
): Promise<Task> {
  const { taskSourceId, projectId, issue } = input

  logger.debug(`Creating task for issue ${issue.id} from task source ${taskSourceId}`)

  return await sql.begin(async (tx) => {
    const convertToBackendIssue = () => {
      switch (issue.metadata.provider) {
        case "github":
          return {
            source_github_issue: {
              id: issue.id,
              iid: issue.iid,
              title: issue.title,
              updated_at: issue.updatedAt,
              metadata: issue.metadata
            }
          }
        case "gitlab":
          return {
            source_gitlab_issue: {
              id: issue.id,
              iid: issue.iid,
              title: issue.title,
              updated_at: issue.updatedAt,
              metadata: issue.metadata
            }
          }
        case "jira":
          return {
            source_jira_issue: {
              id: issue.id,
              title: issue.title,
              updated_at: issue.updatedAt,
              metadata: issue.metadata
            }
          }
        default:
          assertNever(issue.metadata);
          throw new Error('Issue metadata is not supported');
      }
    }

    const taskInput = {
      title: issue.title,
      description: issue.description,
      status: 'pending',
      remote_status: issue.state || 'opened',
      project_id: projectId,
      task_source_id: taskSourceId,
      ...convertToBackendIssue()
    }

    // Remove all undefined values from the entire object (including nested objects)
    const cleanedInput = removeUndefined(taskInput) as CreateTaskInput

    // Use upsert to handle both create and update cases
    let task: Task
    switch (issue.metadata.provider) {
      case 'gitlab':
        task = await taskQueries.upsertTaskFromGitlab(tx, cleanedInput)
        break
      case 'github':
        task = await taskQueries.upsertTaskFromGithub(tx, cleanedInput)
        break
      case 'jira':
        task = await taskQueries.upsertTaskFromJira(tx, cleanedInput)
        break
      default:
        assertNever(issue.metadata)
    }

    logger.info(`Upserted task ${task.id} for issue ${issue.id}`)
    return task
  })
}
