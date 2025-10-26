#!/usr/bin/env bun
/**
 * Task Evaluation Pipeline Runner
 * Analyzes task feasibility using Claude AI with read-only code access
 */

import { ApiClient } from './shared/api-client'
import { mkdir, writeFile } from 'fs/promises'
import { createLogger } from './shared/logger'
import Anthropic from '@anthropic-ai/sdk'
import { HttpsProxyAgent } from 'https-proxy-agent'

const logger = createLogger({ namespace: 'evaluation-pipeline' })

/**
 * Create Anthropic client with optional proxy support
 */
function createAnthropicClient(): Anthropic {
  const config: any = {
    apiKey: process.env.ANTHROPIC_API_KEY!
  }

  // Configure proxy if credentials are provided
  if (process.env.PROXY_HOST && process.env.PROXY_USER && process.env.PROXY_PASS) {
    const proxyUrl = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}`
    config.httpAgent = new HttpsProxyAgent(proxyUrl)
    logger.info(`✓ Using proxy: ${process.env.PROXY_HOST}`)
  }

  return new Anthropic(config)
}

/**
 * Extract JSON from text that might contain markdown code blocks
 */
function extractJSON(text: string): string {
  // Try to find JSON in markdown code blocks first - use greedy match
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*)\n?```/)
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim()
  }

  // Try to find JSON object directly - match the outermost braces
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1).trim()
  }

  // Return original text if no patterns found
  return text.trim()
}

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
 * Phase 1: Simple Filter - Quick gate check
 */
async function simpleEvaluation(task: { title: string; description: string | null }): Promise<{
  should_evaluate: boolean
  clarity_score: number
  has_acceptance_criteria: boolean
  auto_reject_reason: string | null
}> {
  logger.info('🔍 Phase 1: Running simple evaluation filter...')

  const anthropic = createAnthropicClient()

  const prompt = `You are a quick filter for task evaluation. Determine if this task is worth deep analysis.

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided'}

Evaluate:
1. Clarity (1-100): How clear is what needs to be done?
2. Has acceptance criteria: Are there clear success conditions?
3. Should we proceed with deep evaluation?

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "should_evaluate": true/false,
  "clarity_score": 1-100,
  "has_acceptance_criteria": true/false,
  "auto_reject_reason": "reason or null"
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const content = message.content[0]
  if (!content || content.type !== 'text') {
    throw new Error('Invalid response from Claude')
  }

  const jsonText = extractJSON(content.text)

  try {
    const result = JSON.parse(jsonText)
    logger.info(`✓ Simple evaluation: should_evaluate=${result.should_evaluate}, clarity=${result.clarity_score}`)
    return result
  } catch (parseError) {
    logger.error('Failed to parse simple evaluation response')
    logger.error('Raw response:', content.text.substring(0, 500))
    logger.error('Extracted JSON:', jsonText.substring(0, 500))
    throw new Error(`JSON parse error in simple evaluation: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
}

/**
 * Phase 2: Deep Agentic Evaluation - Generate agent instructions
 */
async function agenticEvaluation(
  task: { id: string; title: string; description: string | null; file_space_id: string | null },
  _apiClient: ApiClient
): Promise<{
  verdict: {
    can_implement: boolean
    confidence: number
    agent_instructions: {
      required_context_files: string[]
      suggested_steps: string[]
      follow_patterns_from: string[]
    }
    missing_information: string[]
    blockers: string[]
    risks: string[]
  }
  report: string
}> {
  logger.info('🔬 Phase 2: Running deep agentic evaluation...')

  const anthropic = createAnthropicClient()

  // Check for workspace repositories (submodules)
  const workspacesPath = '../../workspaces'
  const workspaces: string[] = []

  try {
    const { readdirSync } = await import('fs')
    const entries = readdirSync(workspacesPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const gitConfigPath = `${workspacesPath}/${entry.name}/.git`
        if (await Bun.file(gitConfigPath + '/config').exists() || await Bun.file(gitConfigPath).exists()) {
          workspaces.push(entry.name)
          logger.info(`✓ Found workspace: ${entry.name}`)
        }
      }
    }
  } catch {
    logger.warn('No workspaces directory found')
  }

  let codebaseInfo = 'No workspace repositories available'
  if (workspaces.length > 0) {
    logger.info(`📦 Found ${workspaces.length} workspace(s): ${workspaces.join(', ')}`)
    codebaseInfo = `${workspaces.length} workspace repository(ies) available for analysis:\n${workspaces.map(w => `- ${w} (../../workspaces/${w})`).join('\n')}`
  }

  const prompt = `You are evaluating a task and creating an instruction manual for an AI agent.

# Task
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}

# Codebase Status
${codebaseInfo}

# Your Job
Generate TWO outputs:

## 1. STRUCTURED VERDICT (JSON)
{
  "can_implement": boolean,
  "confidence": 1-100,
  "agent_instructions": {
    "required_context_files": ["src/file.ts:10-50"],
    "suggested_steps": ["step 1", "step 2"],
    "follow_patterns_from": ["src/example.ts:20-40"]
  },
  "missing_information": ["question 1"],
  "blockers": ["hard stop 1"],
  "risks": ["risk 1"]
}

## 2. AGENT-READABLE REPORT (Markdown)
# Task: [title]

## RELEVANT FILES
- \`src/auth/middleware.ts:45-120\` - Auth logic
- \`src/types/user.ts:10-30\` - User type

## DATABASE SCHEMA
- Table: users
- Current columns: ...

## API PATTERNS
- Auth endpoints: \`src/auth/routes.ts\`

## TESTING SETUP
- Mocks: \`tests/mocks/auth.ts\`

Respond with JSON containing both:
{
  "verdict": { ... verdict object ... },
  "report": "... markdown report ..."
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  const content = message.content[0]
  if (!content || content.type !== 'text') {
    throw new Error('Invalid response from Claude')
  }

  const jsonText = extractJSON(content.text)

  try {
    const result = JSON.parse(jsonText)
    logger.info(`✓ Agentic evaluation: can_implement=${result.verdict.can_implement}, confidence=${result.verdict.confidence}`)
    return result
  } catch (parseError) {
    logger.error('Failed to parse agentic evaluation response')
    logger.error('Raw response (first 1000 chars):', content.text.substring(0, 1000))
    logger.error('Extracted JSON (first 1000 chars):', jsonText.substring(0, 1000))
    throw new Error(`JSON parse error in agentic evaluation: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
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

    // Create results directory
    await mkdir('../results', { recursive: true })

    // Phase 1: Simple Evaluation Filter
    const simpleResult = await simpleEvaluation(task)

    // Write simple verdict
    await writeFile(
      '../results/simple-verdict.json',
      JSON.stringify(simpleResult, null, 2),
      'utf-8'
    )
    logger.info('📝 Simple verdict written to results/simple-verdict.json')

    if (!simpleResult.should_evaluate) {
      // Task rejected by simple filter - skip deep evaluation
      logger.info('⚠️  Task rejected by simple filter')
      logger.info('✅ Evaluation pipeline completed (early exit)')
      return
    }

    // Phase 2: Deep Agentic Evaluation
    const agenticResult = await agenticEvaluation(task, apiClient)

    // Write agentic verdict JSON
    await writeFile(
      '../results/agentic-verdict.json',
      JSON.stringify(agenticResult.verdict, null, 2),
      'utf-8'
    )
    logger.info('📝 Agentic verdict written to results/agentic-verdict.json')

    // Write agent-readable report
    await writeFile('../results/evaluation-report.md', agenticResult.report, 'utf-8')
    logger.info('📝 Evaluation report written to results/evaluation-report.md')

    logger.info('✅ Evaluation pipeline completed successfully')
  } catch (error) {
    logger.error('❌ Evaluation pipeline failed:', error)

    // Create results directory and error file for upload script
    try {
      await mkdir('../results', { recursive: true })
      await writeFile(
        '../results/error.json',
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
          stack: error instanceof Error ? error.stack : undefined
        }, null, 2),
        'utf-8'
      )
      logger.info('📝 Error file written to results/error.json')
    } catch (writeError) {
      logger.error('Failed to write error file:', writeError)
    }

    // Try to mark the evaluation as failed
    try {
      const sessionId = process.env.SESSION_ID!
      const apiClient = new ApiClient(
        process.env.API_BASE_URL!,
        process.env.API_TOKEN!
      )
      const session = await apiClient.getSession(sessionId)
      if (session.task_id) {
        await apiClient.updateTaskEvaluationStatus(session.task_id, 'failed')
        logger.info('Task evaluation status updated to failed')
      }
    } catch (statusError) {
      logger.error('Failed to update task evaluation status to failed:', statusError)
    }

    throw error
  }
}

main()
