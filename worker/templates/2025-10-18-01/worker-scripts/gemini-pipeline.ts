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

const apiClient = new ApiClient(
  process.env.API_BASE_URL!,
  process.env.API_TOKEN!
)

async function main() {
  const sessionId = process.env.SESSION_ID!
  const executionId = process.env.PIPELINE_EXECUTION_ID!

  console.log('🤖 Gemini Pipeline Started')
  console.log(`Session ID: ${sessionId}`)
  console.log(`Execution ID: ${executionId}`)

  try {
    // Fetch session and task via API
    console.log('📥 Fetching session from API...')
    const session = await apiClient.getSession(sessionId)
    console.log(`✓ Session loaded: runner=${session.runner}`)

    if (!session.task_id) {
      throw new Error('Session has no associated task')
    }

    console.log('📥 Fetching task from API...')
    const task = await apiClient.getTask(session.task_id)
    console.log(`✓ Task loaded: ${task.title}`)

    // Run traffic check
    console.log('🚦 Running traffic check...')
    const trafficCheck = await runTrafficCheck(task)
    if (!trafficCheck.shouldProcess) {
      console.log(`⚠️  Traffic check failed: ${trafficCheck.reason}`)
      process.exit(0)
    }
    console.log('✓ Traffic check passed')

    // Fetch file space if available
    let fileSpace = null
    if (task.file_space_id) {
      console.log('📥 Fetching file space from API...')
      fileSpace = await apiClient.getFileSpace(task.file_space_id)
      console.log(`✓ File space loaded: ${fileSpace.name} (${fileSpace.type})`)
    }

    // Create results directory
    await mkdir('../results', { recursive: true })

    // TODO: Implement actual Gemini execution
    console.log('🔧 Running Gemini agent...')
    console.log(`Task: ${task.title}`)
    console.log(`Description: ${task.description || 'N/A'}`)

    // Simulate agent execution
    const agentResults = {
      exitCode: 0,
      output: 'Gemini agent completed successfully (placeholder)',
      changes: {},
      errors: [],
    }

    // Run completion check
    console.log('✅ Running completion check...')
    const completionCheck = await runCompletionCheck(agentResults)
    if (!completionCheck.isComplete) {
      console.log(
        `⚠️  Completion check failed: ${completionCheck.reason}`
      )
    } else {
      console.log('✓ Completion check passed')
    }

    // Run clarification check
    console.log('❓ Running clarification check...')
    const clarificationCheck = await runClarificationCheck(agentResults)
    if (clarificationCheck.needsClarification) {
      console.log(
        `⚠️  Clarification needed: ${clarificationCheck.reason}`
      )
    } else {
      console.log('✓ No clarification needed')
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

    console.log('✅ Gemini pipeline completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Gemini pipeline failed:', error)
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
