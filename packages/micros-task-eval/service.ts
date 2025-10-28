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

    if (!task.project_id) {
      const errorMsg = 'Task has no associated project'
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'failed')
      return result
    }

    // Get project owner for quota tracking
    const { getProjectOwnerId } = await import('@db/user-access')
    const userId = await getProjectOwnerId(sql, task.project_id)

    if (!userId) {
      const errorMsg = `No project owner found for project ${task.project_id}`
      logger.error(errorMsg)
      result.errors.push(errorMsg)
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'failed')
      return result
    }

    // Check quota and select AI provider for simple evaluation
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
        logger.error(errorMsg)
        result.errors.push(errorMsg)
        await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'failed')
        return result
      }
      throw error
    }

    // Create evaluation session (we'll use this for tracking even if we don't trigger CI)
    const session = await sessionQueries.createSession(sql, {
      task_id: taskId,
      runner: 'evaluation'
    })
    result.sessionId = session.id
    logger.info(`Created evaluation session: ${session.id}`)

    // Update task to evaluating status
    await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'evaluating', session.id)

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
          temperature: aiProviderSelection.config.temperature,
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
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'failed', session.id)
      return result
    }

    // Update task with simple evaluation result
    await taskQueries.updateTaskEvaluationSimpleResult(sql, taskId, simpleEvalResult)
    logger.info('✓ Simple evaluation result saved to database')

    // Note: Usage metrics for simple evaluation are tracked when running in CI (fallback mode)
    // For microservice-only evaluations, usage can be inferred from simple_result presence

    // Check if we should proceed to advanced evaluation
    if (!simpleEvalResult.should_evaluate) {
      // Task rejected by simple filter - complete evaluation without triggering CI
      logger.info('⚠️  Task rejected by simple filter (no advanced evaluation needed)')
      await taskQueries.updateTaskEvaluationResult(sql, taskId, 'needs_clarification')
      await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'completed', session.id)
      logger.info('✓ Evaluation completed (simple only)')
      return result
    }

    // Phase 2: Trigger CI for advanced agentic evaluation
    logger.info('🔬 Phase 2: Checking quota for advanced evaluation...')

    // Check quota and select AI provider for advanced evaluation
    let advancedAIProviderSelection
    try {
      advancedAIProviderSelection = await selectAIProviderForEvaluation(sql, userId, task.project_id, 'advanced')
      logger.info(`AI provider selected for advanced eval: use_platform_token=${advancedAIProviderSelection.use_platform_token}`)

      if (advancedAIProviderSelection.warning) {
        logger.warn(advancedAIProviderSelection.warning)
      }

      // Increment quota immediately if using platform token
      // This prevents race conditions where multiple evaluations could exceed quota
      if (advancedAIProviderSelection.use_platform_token) {
        await quotaQueries.incrementQuotaUsage(sql, userId, 'advanced')
        logger.info(`Incremented advanced evaluation quota for user ${userId}`)
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        const errorMsg = error.message
        logger.error(errorMsg)
        result.errors.push(errorMsg)
        await taskQueries.updateTaskEvaluationResult(sql, taskId, 'needs_clarification')
        await taskQueries.updateTaskEvaluationStatus(sql, taskId, 'completed', session.id)
        return result
      }
      throw error
    }

    logger.info('🔬 Triggering CI for advanced evaluation...')
    const apiClient = createBackendApiClient()

    try {
      const pipelineResult = await triggerPipeline({
        sessionId: session.id,
        apiClient
      })
      result.pipelineUrl = pipelineResult.pipelineUrl
      logger.info(`Advanced evaluation pipeline triggered: ${pipelineResult.pipelineUrl}`)
    } catch (pipelineError) {
      const errorMsg = `Failed to trigger advanced evaluation pipeline: ${pipelineError instanceof Error ? pipelineError.message : String(pipelineError)}`
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
