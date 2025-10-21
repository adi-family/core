#!/usr/bin/env bun
/**
 * Task Evaluation Pipeline Runner
 * Analyzes task feasibility using Claude AI with read-only code access
 */

import { ApiClient } from './shared/api-client'
import { mkdir, writeFile } from 'fs/promises'
import { createLogger } from '@utils/logger.ts'
import Anthropic from '@anthropic-ai/sdk'

const logger = createLogger({ namespace: 'evaluation-pipeline' })

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = [
    'SESSION_ID',
    'PIPELINE_EXECUTION_ID',
    'API_BASE_URL',
    'API_TOKEN',
    'ANTHROPIC_API_KEY'
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }

  logger.info('✓ Environment variables validated')
}

/**
 * Phase 1: Quick feasibility check
 */
async function quickCheck(task: { title: string; description: string | null }): Promise<{
  proceed: boolean
  reason: string
}> {
  logger.info('🔍 Phase 1: Running quick feasibility check...')

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!
  })

  const prompt = `You are evaluating whether a task is actionable and specific enough for AI to implement.

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided'}

Analyze this task and determine:
1. Is it clear what needs to be done?
2. Is it specific enough to implement?
3. Are there any obvious blockers?

Respond in JSON format:
{
  "proceed": true/false,
  "reason": "Brief explanation why this task is ready or not ready for AI implementation"
}`

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Claude')
  }

  const result = JSON.parse(content.text)
  logger.info(`✓ Quick check completed: proceed=${result.proceed}`)

  return result
}

/**
 * Phase 2: Deep analysis with code access
 */
async function deepAnalysis(
  task: { id: string; title: string; description: string | null; file_space_id: string | null },
  apiClient: ApiClient
): Promise<string> {
  logger.info('🔬 Phase 2: Running deep analysis with code access...')

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!
  })

  // Build analysis prompt
  let codebaseContext = ''

  if (task.file_space_id) {
    logger.info(`📥 Fetching file space information...`)
    const fileSpace = await apiClient.getFileSpace(task.file_space_id)
    codebaseContext = `
Repository: ${(fileSpace.config as any).repo || 'Unknown'}
Note: This is read-only access for analysis purposes.
`
  } else {
    codebaseContext = 'No code repository configured for this task.'
  }

  const prompt = `You are analyzing a software task to prepare context for another AI agent that will implement it.

# Task Information
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}

# Codebase Context
${codebaseContext}

# Your Mission
Create a comprehensive markdown analysis document that will help the implementing agent understand:

1. **Task Understanding** - What needs to be done
2. **Relevant Files** - Which files are likely to need changes (use format: \`path/to/file.ts:45-89\`)
3. **Key Components** - Important classes, functions, or patterns to understand
4. **Dependencies** - What libraries or internal modules are relevant
5. **Similar Patterns** - Examples of similar implementations in the codebase
6. **Implementation Context** - Architectural patterns, conventions, or constraints

Format the output as a well-structured markdown document. Be specific and actionable.

Note: You don't have direct access to read files in this analysis, so provide educated guidance based on the task description and typical software architecture patterns. If the task mentions specific errors or files, reference those.`

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Claude')
  }

  logger.info('✓ Deep analysis completed')
  return content.text
}

async function main() {
  logger.info('🤖 Evaluation Pipeline Started')

  try {
    // Validate environment
    validateEnvironment()

    const sessionId = process.env.SESSION_ID!
    const executionId = process.env.PIPELINE_EXECUTION_ID!

    logger.info(`Session ID: ${sessionId}`)
    logger.info(`Execution ID: ${executionId}`)

    const apiClient = new ApiClient(
      process.env.API_BASE_URL!,
      process.env.API_TOKEN!
    )

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

    // Phase 1: Quick feasibility check
    const quickCheckResult = await quickCheck(task)

    // Create results directory
    await mkdir('../results', { recursive: true })

    if (!quickCheckResult.proceed) {
      // Task is not ready - create simple report and exit successfully
      const simpleReport = `# Task Evaluation: ${task.title}

## Quick Check Result
**Status:** Not Ready for Implementation
**Reason:** ${quickCheckResult.reason}

## Recommendation
This task needs clarification or additional information before it can be implemented by AI.
`
      await writeFile('../results/evaluation.md', simpleReport, 'utf-8')
      logger.info('⚠️  Task not ready for implementation (quick check failed)')
      logger.info('✅ Evaluation completed successfully')
      return
    }

    // Phase 2: Deep analysis
    const analysis = await deepAnalysis(task, apiClient)

    // Build final markdown report
    const finalReport = `# Task Evaluation: ${task.title}

## Quick Check
**Status:** ✅ Ready for Implementation
**Reason:** ${quickCheckResult.reason}

---

${analysis}

---

## Metadata
- **Task ID:** ${task.id}
- **Evaluated At:** ${new Date().toISOString()}
- **Model:** claude-3-5-sonnet-20241022
`

    // Write evaluation markdown
    await writeFile('../results/evaluation.md', finalReport, 'utf-8')

    logger.info('📝 Evaluation report written to results/evaluation.md')
    logger.info('✅ Evaluation pipeline completed successfully')
  } catch (error) {
    logger.error('❌ Evaluation pipeline failed:', error)
    throw error
  }
}

main()
