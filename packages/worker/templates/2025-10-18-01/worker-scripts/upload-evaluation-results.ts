#!/usr/bin/env bun
/**
 * Upload Evaluation Results
 * Reads evaluation files (simple-verdict.json, agentic-verdict.json, evaluation-report.md)
 * and updates task with structured data
 */

import { ApiClient } from './shared/api-client'
import { readFile } from 'fs/promises'
import { createLogger } from './shared/logger'

const logger = createLogger({ namespace: 'upload-evaluation' })

const apiClient = new ApiClient(
  process.env.API_BASE_URL!,
  process.env.API_TOKEN!
)

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists()
}

async function main() {
  const executionId = process.env.PIPELINE_EXECUTION_ID!
  const sessionId = process.env.SESSION_ID!

  logger.info('📤 Upload Evaluation Results Started')
  logger.info(`Execution ID: ${executionId}`)
  logger.info(`Session ID: ${sessionId}`)

  try {
    // Fetch session to get task_id
    logger.info('📥 Fetching session...')
    const session = await apiClient.getSession(sessionId)

    if (!session.task_id) {
      throw new Error('Session has no associated task')
    }

    // Fetch task
    logger.info('📥 Fetching task...')
    const task = await apiClient.getTask(session.task_id)
    logger.info(`✓ Task loaded: ${task.title}`)
    logger.info('ℹ️  Simple evaluation already handled by microservice before CI')

    // Upload usage metrics (only agentic eval metrics from CI)
    const agenticUsageFile = '../results/agentic-usage.json'
    if (await fileExists(agenticUsageFile)) {
      try {
        const usageText = await readFile(agenticUsageFile, 'utf-8')
        const usage = JSON.parse(usageText)
        await apiClient.saveApiUsage(executionId, sessionId, task.id, usage)
        logger.info('✓ Agentic evaluation usage metrics uploaded')
      } catch (usageError) {
        logger.error('Failed to upload agentic eval usage:', usageError)
      }
    }

    // Check if agentic evaluation was performed
    const agenticVerdictExists = await fileExists('../results/agentic-verdict.json')
    const reportExists = await fileExists('../results/evaluation-report.md')

    if (agenticVerdictExists && reportExists) {
      // Deep evaluation completed
      const agenticVerdictText = await readFile('../results/agentic-verdict.json', 'utf-8')
      const agenticVerdict = JSON.parse(agenticVerdictText)
      logger.info('✓ Agentic verdict loaded')

      const reportText = await readFile('../results/evaluation-report.md', 'utf-8')
      logger.info('✓ Evaluation report loaded')

      // Add report to agentic result
      const agenticResult = {
        ...agenticVerdict,
        report: reportText
      }

      // Update task with agentic evaluation result
      await apiClient.updateTaskEvaluationAgentic(task.id, agenticResult)
      logger.info('✓ Task agentic evaluation updated')

      // Create pipeline artifact with report
      await apiClient.createPipelineArtifact(executionId, {
        artifact_type: 'text',
        reference_url: '#',
        metadata: {
          title: `Evaluation: ${task.title}`,
          task_id: task.id,
          evaluation_content: reportText,
          can_implement: agenticVerdict.can_implement,
          confidence: agenticVerdict.confidence,
          evaluated_at: new Date().toISOString(),
        },
      })
      logger.info('✓ Created pipeline artifact')

      // Update task evaluation status and result
      await apiClient.updateTaskEvaluationStatus(task.id, 'completed')
      logger.info('✓ Task evaluation status: completed')

      const evaluationResult = agenticVerdict.can_implement ? 'ready' : 'needs_clarification'
      await apiClient.updateTaskEvaluationResult(task.id, evaluationResult)
      logger.info(`✓ Task evaluation result: ${evaluationResult}`)
    } else {
      // No agentic evaluation results found
      // Simple eval was already done in microservice and passed (otherwise CI wouldn't have been triggered)
      // This means agentic eval failed or didn't complete
      logger.error('❌ Agentic evaluation did not complete - marking evaluation as failed')
      await apiClient.updateTaskEvaluationStatus(task.id, 'failed')
    }

    logger.info('✅ Upload evaluation results completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Upload evaluation results failed:', error)
    process.exit(1)
  }
}

main()
