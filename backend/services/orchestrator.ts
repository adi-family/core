/**
 * Task Orchestrator Service
 * Fetches issues from task sources and triggers pipeline execution
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger.ts'
import * as taskQueries from '../../db/tasks'
import * as projectQueries from '../../db/projects'
import * as taskSourceQueries from '../../db/task-sources'
import * as fileSpaceQueries from '../../db/file-spaces'
import * as workerRepoQueries from '../../db/worker-repositories'
import * as workerCacheDb from '../../db/worker-cache'
import type { TaskSource as TaskSourceDb } from '../../types'
import type { TaskSource, TaskSourceIssue } from '../task-sources/base'
import { createTaskSource } from '../task-sources/factory'

const logger = createLogger({ namespace: 'orchestrator' })

export interface ProcessTaskSourceInput {
  taskSourceId: string
}

export interface ProcessTaskSourceResult {
  tasksCreated: number
  errors: string[]
}

/**
 * Process a single task source: fetch issues and create tasks
 */
export async function processTaskSource(
  sql: Sql,
  input: ProcessTaskSourceInput
): Promise<ProcessTaskSourceResult> {
  const { taskSourceId } = input

  const result: ProcessTaskSourceResult = {
    tasksCreated: 0,
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

    if (!taskSource.enabled) {
      result.errors.push(`Task source is disabled: ${taskSourceId}`)
      return result
    }

    // Fetch project
    const projectResult = await projectQueries.findProjectById(sql, taskSource.project_id)
    if (!projectResult.ok) {
      result.errors.push(`Project not found: ${taskSource.project_id}`)
      return result
    }

    const project = projectResult.data

    if (!project.enabled) {
      result.errors.push(`Project is disabled: ${project.id}`)
      return result
    }

    // Fetch file spaces for this project
    const fileSpaces = await fileSpaceQueries.findFileSpacesByProjectId(sql, project.id)
    if (fileSpaces.length === 0) {
      result.errors.push(`No file spaces found for project: ${project.id}`)
      return result
    }

    // Fetch worker repository
    const workerRepoResult = await workerRepoQueries.findWorkerRepositoryByProjectId(sql, project.id)
    if (!workerRepoResult.ok) {
      result.errors.push(`Worker repository not found for project: ${project.id}`)
      return result
    }

    // Fetch issues from task source
    const issues = await fetchIssuesFromTaskSource(taskSource)
    logger.info(`Fetched ${issues.length} issues from task source ${taskSource.name}`)

    // Process each issue
    for (const issue of issues) {
      try {
        // Check if already processed using worker cache
        const cache = workerCacheDb.initTrafficLight(sql, project.id)
        const alreadySignaled = await cache.isSignaledBefore(issue.id, issue.updatedAt)

        if (alreadySignaled) {
          logger.info(`Issue ${issue.id} already processed, skipping`)
          continue
        }

        // Try to acquire lock
        const lockAcquired = await cache.tryAcquireLock({
          issueId: issue.id,
          workerId: 'orchestrator',
          lockTimeoutSeconds: 3600 // 1 hour
        })

        if (!lockAcquired) {
          logger.info(`Could not acquire lock for issue ${issue.id}, skipping`)
          continue
        }

        try {
          // Convert TaskSourceIssue to backend issue format
          const convertToBackendIssue = () => {
            if (taskSource.type === 'gitlab_issues' && issue.metadata.provider === 'gitlab') {
              return {
                source_gitlab_issue: {
                  id: issue.id,
                  iid: issue.iid,
                  title: issue.title,
                  updated_at: issue.updatedAt,
                  metadata: issue.metadata
                }
              }
            } else if (taskSource.type === 'jira' && issue.metadata.provider === 'jira') {
              return {
                source_jira_issue: {
                  id: issue.id,
                  title: issue.title,
                  updated_at: issue.updatedAt,
                  metadata: issue.metadata
                }
              }
            } else if (taskSource.type === 'github_issues' && issue.metadata.provider === 'github') {
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

          // Create task
          const task = await taskQueries.createTask(sql, {
            title: issue.title,
            description: issue.description || undefined,
            status: 'pending',
            project_id: project.id,
            task_source_id: taskSource.id,
            ...convertToBackendIssue()
          })

          result.tasksCreated++
          logger.info(`Created task ${task.id} for issue ${issue.id}`)

          // Signal in worker cache
          await cache.signal({
            issueId: issue.id,
            date: issue.updatedAt,
            taskId: task.id
          })
        } catch (taskError) {
          // Release lock on task creation failure
          await cache.releaseLock(issue.id)
          throw taskError
        }
      } catch (issueError) {
        const errorMsg = `Failed to process issue ${issue.id}: ${issueError instanceof Error ? issueError.message : String(issueError)}`
        logger.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }
  } catch (error) {
    const errorMsg = `Failed to process task source ${taskSourceId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
  }

  return result
}

/**
 * Fetch issues from a task source based on its type
 */
async function fetchIssuesFromTaskSource(taskSource: TaskSourceDb): Promise<TaskSourceIssue[]> {
  try {
    const taskSourceInstance = createTaskSource(taskSource as TaskSource)
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
 * Process all enabled task sources for a project
 */
export async function processProjectTaskSources(
  sql: Sql,
  projectId: string
): Promise<ProcessTaskSourceResult> {
  const taskSources = await taskSourceQueries.findTaskSourcesByProjectId(sql, projectId)

  const combinedResult: ProcessTaskSourceResult = {
    tasksCreated: 0,
    errors: []
  }

  for (const taskSource of taskSources) {
    if (!taskSource.enabled) {
      continue
    }

    const result = await processTaskSource(sql, {
      taskSourceId: taskSource.id
    })

    combinedResult.tasksCreated += result.tasksCreated
    combinedResult.errors.push(...result.errors)
  }

  return combinedResult
}

/**
 * Process all enabled projects
 */
export async function processAllProjects(
  sql: Sql
): Promise<ProcessTaskSourceResult> {
  const projects = await projectQueries.findAllProjects(sql)

  const combinedResult: ProcessTaskSourceResult = {
    tasksCreated: 0,
    errors: []
  }

  for (const project of projects) {
    if (!project.enabled) {
      continue
    }

    const result = await processProjectTaskSources(sql, project.id)

    combinedResult.tasksCreated += result.tasksCreated
    combinedResult.errors.push(...result.errors)
  }

  return combinedResult
}
