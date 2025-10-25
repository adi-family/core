#!/usr/bin/env bun
/**
 * Upload Evaluation Results
 * Reads the evaluation markdown report and creates a text artifact
 */

import { ApiClient } from './shared/api-client'
import { readFile } from 'fs/promises'
import { createLogger } from './shared/logger'

const logger = createLogger({ namespace: 'upload-evaluation' })

const apiClient = new ApiClient(
  process.env.API_BASE_URL!,
  process.env.API_TOKEN!
)

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

    // Read evaluation markdown
    logger.info('📥 Reading evaluation report...')
    const evaluationText = await readFile('../results/evaluation.md', 'utf-8')
    logger.info('✓ Evaluation report loaded')

    // Check if task is ready for implementation based on report content
    const isReady = evaluationText.includes('Ready for Implementation')

    logger.info('📝 Creating pipeline artifact...')

    // Create text artifact with the evaluation report
    await apiClient.createPipelineArtifact(executionId, {
      artifact_type: 'text',
      reference_url: '#',
      metadata: {
        title: `Evaluation: ${task.title}`,
        task_id: task.id,
        evaluation_content: evaluationText,
        is_ready: isReady,
        evaluated_at: new Date().toISOString(),
      },
    })

    logger.info(`✓ Created artifact: evaluation report`)

    // Update task evaluation status based on result
    logger.info('📝 Updating task evaluation status...')
    const newStatus = isReady ? 'ready' : 'needs_clarification'

    await apiClient.updateTaskEvaluationStatus(task.id, newStatus)
    logger.info(`✓ Task evaluation status updated to: ${newStatus}`)

    logger.info('✅ Upload evaluation results completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Upload evaluation results failed:', error)
    process.exit(1)
  }
}

main()
