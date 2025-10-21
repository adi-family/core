/**
 * Task Evaluation Service
 * Creates evaluation session and triggers GitLab pipeline for AI analysis
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import * as taskQueries from '@db/tasks'
import * as sessionQueries from '@db/sessions'
import { triggerPipeline } from '@backend/worker-orchestration/pipeline-executor'
import { createBackendApiClient } from '@backend/api-client'

const logger = createLogger({ namespace: 'task-eval' })

export interface EvaluateTaskInput {
  taskId: string
}

export interface EvaluateTaskResult {
  sessionId: string
  pipelineUrl?: string
  errors: string[]
}

/**
 * Evaluate a task: create session with runner="evaluation" and trigger pipeline
 */
export async function evaluateTask(
  sql: Sql,
  input: EvaluateTaskInput
): Promise<EvaluateTaskResult> {
  const { taskId } = input

  const result: EvaluateTaskResult = {
    sessionId: '',
    errors: []
  }

  try {
    // Mark task as queued
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'queued')
    logger.info(`Task ${taskId} marked as queued for evaluation`)

    // Fetch task to validate it exists
    const taskResult = await taskQueries.findTaskById(sql, taskId)
    if (!taskResult.ok) {
      result.errors.push(`Task not found: ${taskId}`)
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'failed')
      return result
    }

    const task = taskResult.data
    logger.info(`Evaluating task: ${task.title}`)

    // Create evaluation session
    const session = await sessionQueries.createSession(sql, {
      task_id: taskId,
      runner: 'evaluation'
    })
    result.sessionId = session.id
    logger.info(`Created evaluation session: ${session.id}`)

    // Update task with session ID and mark as evaluating
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'evaluating', session.id)

    // Create API client for pipeline executor
    const apiClient = createBackendApiClient()

    // Trigger pipeline
    try {
      const pipelineResult = await triggerPipeline({
        sessionId: session.id,
        apiClient
      })
      result.pipelineUrl = pipelineResult.pipelineUrl
      logger.info(`Evaluation pipeline triggered: ${pipelineResult.pipelineUrl}`)
    } catch (pipelineError) {
      const errorMsg = `Failed to trigger evaluation pipeline: ${pipelineError instanceof Error ? pipelineError.message : String(pipelineError)}`
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'failed', session.id)
      return result
    }

    logger.info(`Task ${taskId} evaluation started successfully`)
  } catch (error) {
    const errorMsg = `Failed to evaluate task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'failed')
  }

  return result
}
