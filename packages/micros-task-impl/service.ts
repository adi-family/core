/**
 * Task Implementation Service
 * Creates implementation session and triggers GitLab pipeline for AI implementation
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import * as taskQueries from '@db/tasks'
import * as sessionQueries from '@db/sessions'
import { triggerPipeline } from '@backend/worker-orchestration/pipeline-executor'
import { createBackendApiClient } from '@backend/api-client'

const logger = createLogger({ namespace: 'task-impl' })

export interface ImplementTaskInput {
  taskId: string
}

export interface ImplementTaskResult {
  sessionId: string
  pipelineUrl?: string
  errors: string[]
}

/**
 * Implement a task: create session with runner="claude" and trigger pipeline
 */
export async function implementTask(
  sql: Sql,
  input: ImplementTaskInput
): Promise<ImplementTaskResult> {
  const { taskId } = input

  const result: ImplementTaskResult = {
    sessionId: '',
    errors: []
  }

  try {
    // Mark task as queued
    await taskQueries.updateTaskImplementationStatus(sql, taskId, 'queued')
    logger.info(`Task ${taskId} marked as queued for implementation`)

    // Fetch task to validate it exists
    const taskResult = await taskQueries.findTaskById(sql, taskId)
    if (!taskResult.ok) {
      result.errors.push(`Task not found: ${taskId}`)
      await taskQueries.updateTaskImplementationStatus(sql, taskId, 'failed')
      return result
    }

    const task = taskResult.data
    logger.info(`Implementing task: ${task.title}`)

    // Create implementation session with runner="claude" (claude-pipeline.ts handles implementation)
    const session = await sessionQueries.createSession(sql, {
      task_id: taskId,
      runner: 'claude'
    })
    result.sessionId = session.id
    logger.info(`🔍 DEBUG - Created implementation session:`)
    logger.info(`  Session ID: ${session.id}`)
    logger.info(`  Runner type: ${session.runner}`)
    logger.info(`  Task ID: ${session.task_id}`)
    logger.info(`  Expected RUNNER_TYPE in pipeline: ${session.runner}`)

    // Update task with session ID and mark as implementing
    await taskQueries.updateTaskImplementationStatus(sql, taskId, 'implementing', session.id)

    // Create API client for pipeline executor
    const apiClient = createBackendApiClient()

    // Trigger pipeline
    try {
      const pipelineResult = await triggerPipeline({
        sessionId: session.id,
        apiClient
      })
      result.pipelineUrl = pipelineResult.pipelineUrl
      logger.info(`Implementation pipeline triggered: ${pipelineResult.pipelineUrl}`)
    } catch (pipelineError) {
      const errorMsg = `Failed to trigger implementation pipeline: ${pipelineError instanceof Error ? pipelineError.message : String(pipelineError)}`
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskImplementationStatus(sql, taskId, 'failed', session.id)
      return result
    }

    logger.info(`Task ${taskId} implementation started successfully`)
  } catch (error) {
    const errorMsg = `Failed to implement task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
    await taskQueries.updateTaskImplementationStatus(sql, taskId, 'failed')
  }

  return result
}
