#!/usr/bin/env bun
/**
 * Gemini Pipeline Runner
 * Executes Google Gemini agent on tasks
 */

import { ApiClient } from './shared/api-client'
import { runCompletionCheck } from './shared/completion-check'
import { runClarificationCheck } from './shared/clarification-check'
import { validateEnvironment } from './shared/env-validator'
import { mkdir } from 'fs/promises'
import { createLogger } from './shared/logger'

const logger = createLogger({ namespace: 'gemini-pipeline' })
const RESULTS_DIR = '2025-10-18-01/results'

async function main() {
  logger.info('🤖 Gemini Pipeline Started')

  try {
    // Validate environment
    const {
      SESSION_ID, API_BASE_URL, API_TOKEN, PIPELINE_EXECUTION_ID,
    } = validateEnvironment([
      'SESSION_ID',
      'PIPELINE_EXECUTION_ID',
      'API_BASE_URL',
      'API_TOKEN',
    ])

    logger.info(`Session ID: ${SESSION_ID}`)
    logger.info(`Execution ID: ${PIPELINE_EXECUTION_ID}`)

    const apiClient = new ApiClient(API_BASE_URL, API_TOKEN)
    // Fetch session and task via API
    logger.info('📥 Fetching session from API...')
    const session = await apiClient.getSession(SESSION_ID)
    logger.info(`✓ Session loaded: runner=${session.runner}`)

    if (!session.task_id) {
      throw new Error('Session has no associated task')
    }

    logger.info('📥 Fetching task from API...')
    const task = await apiClient.getTask(session.task_id)
    logger.info(`✓ Task loaded: ${task.title}`)

    // Fetch file spaces associated with this task via junction table
    let fileSpace = null
    logger.info('📥 Fetching task file spaces from API...')
    const fileSpaces = await apiClient.getFileSpacesByTask(task.id)

    if (fileSpaces.length > 0) {
      // Use the first file space if multiple are configured
      const firstFileSpace = fileSpaces[0]
      if (firstFileSpace) {
        fileSpace = firstFileSpace
        logger.info(`✓ File space loaded: ${fileSpace.name} (${fileSpace.type})`)
      }
    } else {
      logger.info('ℹ️  No file space configured for this task')
    }

    // Create results directory
    await mkdir(RESULTS_DIR, { recursive: true })

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
      `${RESULTS_DIR}/output.json`,
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
      `${RESULTS_DIR}/error.json`,
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

// Export for use in worker binary
export { main as geminiPipeline }

// Run if called directly (not from worker binary)
if (!process.env.__WORKER_BINARY__) {
  const isMainModule = import.meta.url === `file://${process.argv[1]}`
  if (isMainModule) {
    main()
  }
}
