#!/usr/bin/env bun
/**
 * Gemini Pipeline Runner
 * Executes Google Gemini agent on tasks
 */

import { ApiClient } from './shared/api-client'
import { runTrafficCheck } from './shared/traffic-check'
import { runCompletionCheck } from './shared/completion-check'
import { runClarificationCheck } from './shared/clarification-check'
import { mkdir } from 'fs/promises'
import { createLogger } from '@utils/logger.ts'

const logger = createLogger({ namespace: 'gemini-pipeline' })

const apiClient = new ApiClient(
  process.env.API_BASE_URL!,
  process.env.API_TOKEN!
)

async function main() {
  const sessionId = process.env.SESSION_ID!
  const executionId = process.env.PIPELINE_EXECUTION_ID!

  logger.info('🤖 Gemini Pipeline Started')
  logger.info(`Session ID: ${sessionId}`)
  logger.info(`Execution ID: ${executionId}`)

  try {
    // Fetch session and task via API
    logger.info('📥 Fetching session from API...')
    const session = await apiClient.getSession(sessionId)
    logger.info(`✓ Session loaded: runner=${session.runner}`)

    if (!session.task_id) {
      throw new Error('Session has no associated task')
    }

    logger.info('📥 Fetching task from API...')
    const task = await apiClient.getTask(session.task_id)
    logger.info(`✓ Task loaded: ${task.title}`)

    // Run traffic check
    logger.info('🚦 Running traffic check...')
    const trafficCheck = await runTrafficCheck(task)
    if (!trafficCheck.shouldProcess) {
      logger.warn(`⚠️  Traffic check failed: ${trafficCheck.reason}`)
      process.exit(0)
    }
    logger.info('✓ Traffic check passed')

    // Fetch file space if available
    let fileSpace = null
    if (task.file_space_id) {
      logger.info('📥 Fetching file space from API...')
      fileSpace = await apiClient.getFileSpace(task.file_space_id)
      logger.info(`✓ File space loaded: ${fileSpace.name} (${fileSpace.type})`)
    }

    // Create results directory
    await mkdir('../results', { recursive: true })

    // TODO: Implement actual Gemini execution
    logger.info('🔧 Running Gemini agent...')
    logger.info(`Task: ${task.title}`)
    logger.info(`Description: ${task.description || 'N/A'}`)

    // Simulate agent execution
    const agentResults = {
      exitCode: 0,
      output: 'Gemini agent completed successfully (placeholder)',
      changes: {},
      errors: [],
    }

    // Run completion check
    logger.info('✅ Running completion check...')
    const completionCheck = await runCompletionCheck(agentResults)
    if (!completionCheck.isComplete) {
      logger.warn(
        `⚠️  Completion check failed: ${completionCheck.reason}`
      )
    } else {
      logger.info('✓ Completion check passed')
    }

    // Run clarification check
    logger.info('❓ Running clarification check...')
    const clarificationCheck = await runClarificationCheck(agentResults)
    if (clarificationCheck.needsClarification) {
      logger.warn(
        `⚠️  Clarification needed: ${clarificationCheck.reason}`
      )
    } else {
      logger.info('✓ No clarification needed')
    }

    // Save results
    await Bun.write(
      '../results/output.json',
      JSON.stringify(
        {
          session,
          task,
          fileSpace,
          agentResults,
          completionCheck,
          clarificationCheck,
        },
        null,
        2
      )
    )

    logger.info('✅ Gemini pipeline completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Gemini pipeline failed:', error)
    await Bun.write(
      '../results/error.json',
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2
      )
    )
    process.exit(1)
  }
}

main()
