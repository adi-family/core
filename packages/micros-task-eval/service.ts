/**
 * Task Evaluation Service
 * Runs simple evaluation in microservice, then conditionally triggers CI for advanced eval
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import * as taskQueries from '@db/tasks'
import * as sessionQueries from '@db/sessions'
import * as quotaQueries from '@db/user-quotas'
import { triggerPipeline } from '@backend/worker-orchestration/pipeline-executor'
import { createBackendApiClient } from '@backend/api-client'
import { evaluateSimple } from './simple-evaluator'
import { selectAIProviderForEvaluation, QuotaExceededError } from '@backend/services/ai-provider-selector'
import { getProjectOwnerId } from '@db/user-access'
import { TASK_STATUS, EVALUATION_VERDICTS } from '@config/shared'

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
 * Evaluate a task: run simple eval in microservice, then conditionally trigger CI for advanced eval
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
    // Fetch task to validate it exists
    const task = await taskQueries.findTaskById(sql, taskId)

    if (!task.project_id) {
      const errorMsg = 'Task has no associated project'
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[4])
      return result
    }

    // Get project owner for quota tracking
    const userId = await getProjectOwnerId(sql, task.project_id)

    if (!userId) {
      const errorMsg = `No project owner found for project ${task.project_id}`
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[4])
      return result
    }

    // Check quota and select AI provider for simple evaluation BEFORE marking as queued
    let aiProviderSelection
    try {
      aiProviderSelection = await selectAIProviderForEvaluation(sql, userId, task.project_id, 'simple')
      logger.info(`AI provider selected: use_platform_token=${aiProviderSelection.use_platform_token}`)

      if (aiProviderSelection.warning) {
        logger.warn(aiProviderSelection.warning)
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        const errorMsg = error.message
        logger.warn(errorMsg)
        result.errors.push(errorMsg)
        // Task stays in pending status - no need to revert since we haven't changed it yet
        logger.info(`Task ${taskId} skipped due to quota exceeded`)
        return result
      }
      throw error
    }

    // Now mark task as queued AFTER quota check passes
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[1])
    logger.info(`Task ${taskId} marked as queued for evaluation`)
    logger.info(`Evaluating task: ${task.title}`)

    // Create evaluation session (we'll use this for tracking even if we don't trigger CI)
    const session = await sessionQueries.createSession(sql, {
      task_id: taskId,
      runner: 'evaluation'
    })
    result.sessionId = session.id
    logger.info(`Created evaluation session: ${session.id}`)

    // Update task to evaluating status
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[2], session.id)

    // Phase 1: Run simple evaluation in microservice
    logger.info('🔍 Phase 1: Running simple evaluation in microservice...')
    let simpleEvalResult
    let simpleEvalUsage

    try {
      const simpleEval = await evaluateSimple(
        {
          title: task.title,
          description: task.description
        },
        {
          api_key: aiProviderSelection.config.api_key,
          model: aiProviderSelection.config.model,
          max_tokens: aiProviderSelection.config.max_tokens,
          temperature: 'temperature' in aiProviderSelection.config ? aiProviderSelection.config.temperature : 1.0,
          endpoint_url: aiProviderSelection.config.type === 'self-hosted'
            ? aiProviderSelection.config.endpoint_url
            : undefined
        }
      )
      simpleEvalResult = simpleEval.result
      simpleEvalUsage = simpleEval.usage

      logger.info(`✓ Simple evaluation completed: should_evaluate=${simpleEvalResult.should_evaluate}`)

      // Increment quota if using platform token
      if (aiProviderSelection.use_platform_token) {
        await quotaQueries.incrementQuotaUsage(sql, userId, 'simple')
        logger.info(`Incremented simple evaluation quota for user ${userId}`)
      }

      // TODO: Save usage metrics to api_usage_metrics table
      // For now, just log it
      logger.info(`📊 Usage: ${simpleEvalUsage.input_tokens} input + ${simpleEvalUsage.output_tokens} output tokens, platform_token=${aiProviderSelection.use_platform_token}`)
    } catch (simpleError) {
      // Simple eval failed - mark as failed and exit
      const errorMsg = `Simple evaluation failed: ${simpleError instanceof Error ? simpleError.message : String(simpleError)}`
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[4], session.id)
      return result
    }

    // Update task with simple evaluation result
    await taskQueries.updateTaskEvaluationSimpleResult(sql, taskId, simpleEvalResult)
    logger.info('✓ Simple evaluation result saved to database')

    // Note: Usage metrics for simple evaluation are tracked when running in CI (fallback mode)
    // For microservice-only evaluations, usage can be inferred from simple_result presence

    // Check simple evaluation result
    if (!simpleEvalResult.should_evaluate) {
      // Task rejected by simple filter - complete simple evaluation
      logger.info('⚠️  Task rejected by simple filter (no advanced evaluation needed)')
      await taskQueries.updateTaskEvaluationResult(sql, taskId, EVALUATION_VERDICTS[1])
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[3], session.id)
      logger.info('✓ Simple evaluation completed (rejected)')
      return result
    }

    // Simple evaluation passed - mark as ready for advanced evaluation
    logger.info('✓ Simple evaluation passed - task ready for advanced evaluation')
    await taskQueries.updateTaskEvaluationResult(sql, taskId, EVALUATION_VERDICTS[0])
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[3], session.id)
    logger.info('✓ Simple evaluation completed successfully - waiting for manual advanced evaluation trigger')

    // Note: Advanced evaluation must be triggered manually by the user
    // The user will click "Run Advanced Evaluation" button in the UI
  } catch (error) {
    const errorMsg = `Failed to evaluate task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, TASK_STATUS.evaluation[4])
  }

  return result
}

/**
 * Evaluate task advanced - triggers only the advanced agentic evaluation
 * This is called manually by the user after simple evaluation is complete
 */
export async function evaluateTaskAdvanced(
  sql: Sql,
  input: EvaluateTaskInput
): Promise<EvaluateTaskResult> {
  const { taskId } = input

  const result: EvaluateTaskResult = {
    sessionId: '',
    errors: []
  }

  try {
    logger.info(`Starting advanced evaluation for task ${taskId}`)

    // Fetch task
    const task = await taskQueries.findTaskById(sql, taskId)

    // Validate that simple evaluation is completed
    if (task.ai_evaluation_simple_status !== 'completed') {
      throw new Error('Simple evaluation must be completed before running advanced evaluation')
    }

    // Validate that simple evaluation passed
    if (task.ai_evaluation_simple_verdict !== 'ready') {
      throw new Error('Simple evaluation must have verdict "ready" before running advanced evaluation')
    }

    // Validate task has project
    if (!task.project_id) {
      throw new Error('Task must have a project_id to run advanced evaluation')
    }

    // Get user for quota checking
    const userId = await getProjectOwnerId(sql, task.project_id)
    if (!userId) {
      throw new Error(`No project owner found for project ${task.project_id}`)
    }

    // Check quota and select AI provider for advanced evaluation
    let advancedAIProviderSelection
    try {
      advancedAIProviderSelection = await selectAIProviderForEvaluation(sql, userId, task.project_id, 'advanced')
      logger.info(`AI provider selected for advanced eval: use_platform_token=${advancedAIProviderSelection.use_platform_token}`)

      if (advancedAIProviderSelection.warning) {
        logger.warn(advancedAIProviderSelection.warning)
      }

      // Increment quota immediately if using platform token
      if (advancedAIProviderSelection.use_platform_token) {
        await quotaQueries.incrementQuotaUsage(sql, userId, 'advanced')
        logger.info(`Incremented advanced evaluation quota for user ${userId}`)
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        throw new Error(`Quota exceeded for advanced evaluation: ${error.message}`)
      }
      throw error
    }

    // Create evaluation session for advanced eval
    const session = await sessionQueries.createSession(sql, {
      task_id: taskId,
      runner: 'evaluation'
    })
    result.sessionId = session.id
    logger.info(`Created advanced evaluation session: ${session.id}`)

    // Update task to evaluating status for advanced eval
    await taskQueries.updateTaskEvaluationAdvancedStatus(sql, taskId, TASK_STATUS.evaluation[2], session.id)

    // Trigger CI for advanced agentic evaluation
    logger.info('🔬 Triggering CI for advanced evaluation...')
    const apiClient = createBackendApiClient()

    try {
      const pipelineResult = await triggerPipeline({
        sessionId: session.id,
        apiClient
      }, sql)
      result.pipelineUrl = pipelineResult.pipelineUrl
      logger.info(`Advanced evaluation pipeline triggered: ${pipelineResult.pipelineUrl}`)
    } catch (pipelineError) {
      const errorMsg = `Failed to trigger advanced evaluation pipeline: ${pipelineError instanceof Error ? pipelineError.message : String(pipelineError)}`
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskEvaluationAdvancedStatus(sql, taskId, TASK_STATUS.evaluation[4], session.id)
      return result
    }

    logger.info(`Task ${taskId} advanced evaluation started successfully`)
  } catch (error) {
    const errorMsg = `Failed to start advanced evaluation for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error(errorMsg)
    result.errors.push(errorMsg)
    if (result.sessionId) {
      await taskQueries.updateTaskEvaluationAdvancedStatus(sql, taskId, TASK_STATUS.evaluation[4])
    }
  }

  return result
}
