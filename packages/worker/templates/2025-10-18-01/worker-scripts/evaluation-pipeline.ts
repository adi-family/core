#!/usr/bin/env bun
/**
 * Task Evaluation Pipeline Runner
 * Analyzes task feasibility using Claude AI with read-only code access
 */

import { ApiClient } from './shared/api-client'
import { validateEnvironment } from './shared/env-validator'
import { mkdir, writeFile } from 'fs/promises'
import { createLogger } from './shared/logger'
import Anthropic from '@anthropic-ai/sdk'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { query } from '@anthropic-ai/claude-agent-sdk'

const logger = createLogger({ namespace: 'evaluation-pipeline' })

/**
 * Create Anthropic client with optional proxy support (used for simple evaluation)
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
 * Phase 1: Simple Filter - Quick gate check
 */
async function simpleEvaluation(task: { title: string; description: string | null }): Promise<{
  should_evaluate: boolean
  clarity_score: number
  has_acceptance_criteria: boolean
  auto_reject_reason: string | null
}> {
  logger.info('🔍 Phase 1: Running simple evaluation filter...')

  const pipelineStart = Date.now()
  const anthropic = createAnthropicClient()

  const prompt = `You are a quick filter for automated task evaluation. Your job is to REJECT tasks that cannot be solved by an autonomous agent.

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided'}

IMMEDIATELY REJECT if the task:
- Requires manual testing or manual verification
- Needs complex/uncommon third-party integrations
- Requires human interaction or approval during execution
- Involves external services without clear API documentation
- Needs UI/UX testing or visual verification
- Requires access to systems not available to the agent

ONLY PROCEED if the task:
- Can be solved with code changes only
- Has clear, testable success criteria
- Uses common, well-documented integrations
- Can be verified programmatically

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

    // Track usage for simple evaluation
    const simpleUsage = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      goal: 'evaluation',
      phase: 'simple_eval',
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: message.usage.cache_read_input_tokens || 0,
      ci_duration_seconds: Math.floor((Date.now() - pipelineStart) / 1000)
    }

    await writeFile(
      '../results/simple-usage.json',
      JSON.stringify(simpleUsage, null, 2),
      'utf-8'
    )
    logger.info('📊 Simple evaluation usage tracked')

    return result
  } catch (parseError) {
    logger.error('Failed to parse simple evaluation response')
    logger.error('Raw response:', content.text.substring(0, 500))
    logger.error('Extracted JSON:', jsonText.substring(0, 500))
    throw new Error(`JSON parse error in simple evaluation: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
}

/**
 * Phase 2: Deep Agentic Evaluation - Generate agent instructions using Claude Code Agent SDK
 */
async function agenticEvaluation(
  task: { id: string; title: string; description: string | null },
  env: Record<string, string>
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

  // Check for workspace repositories (submodules)
  const workspacesPath = '../workspaces'
  const workspaces: string[] = []

  try {
    const { readdirSync } = await import('fs')
    const entries = readdirSync(workspacesPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const gitConfigPath = `${workspacesPath}/${entry.name}/.git`
        if (await Bun.file(gitConfigPath + '/config').exists() || await Bun.file(gitConfigPath).exists()) {
          workspaces.push(entry.name)
          logger.info(`✓ Found workspace: ${entry.name}`)
        }
      }
    }
  } catch (error) {
    logger.warn('No workspaces directory found:', error instanceof Error ? error.message : String(error))
  }

  let codebaseInfo = 'No workspace repositories available'
  if (workspaces.length > 0) {
    logger.info(`📦 Found ${workspaces.length} workspace(s): ${workspaces.join(', ')}`)
    codebaseInfo = `${workspaces.length} workspace repository(ies) available for analysis:\n${workspaces.map(w => `- workspaces/${w}/`).join('\n')}`
  }

  const prompt = `You MUST evaluate a task by exploring the codebase and creating two files.

# Task to Evaluate
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}

# Available Codebase
${codebaseInfo}

# CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:

1. **EXPLORE THE CODEBASE FIRST**: Use Read, Glob, and Grep tools to find relevant files
2. **ANALYZE THE CODE**: Understand existing patterns, database schema, and architecture
3. **CREATE FILE 1**: Use the Write tool to create \`results/agentic-verdict.json\` with this EXACT structure:
\`\`\`json
{
  "can_implement": boolean,
  "confidence": 1-100,
  "agent_instructions": {
    "required_context_files": ["path/to/file.ts:10-50"],
    "suggested_steps": ["concrete step 1", "concrete step 2"],
    "follow_patterns_from": ["path/to/example.ts:20-40"]
  },
  "missing_information": ["specific question 1"],
  "blockers": ["specific blocker 1"],
  "risks": ["specific risk 1"]
}
\`\`\`

4. **CREATE FILE 2**: Use the Write tool to create \`results/evaluation-report.md\` with detailed findings including:
   - RELEVANT FILES (with specific line numbers and descriptions)
   - DATABASE SCHEMA (current state and required changes)
   - EXISTING PATTERNS (how similar features are implemented)
   - TESTING APPROACH (what tests exist and what's needed)
   - Any other relevant technical details

**CRITICAL**: You MUST use the Write tool TWICE - once for each file. Do NOT just describe what the files should contain. ACTUALLY CREATE THEM using Write tool calls.

Your final message should be brief (1-2 sentences) confirming files were created. The actual content goes IN the files, not in your response.`

  // Execute Claude Agent SDK
  let iterations = 0
  const agenticStart = Date.now()

  try {
    logger.info('🤖 Starting Claude Agent SDK for evaluation...')

    // Ensure ANTHROPIC_API_KEY is in process.env for Claude Code
    if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
    }

    // Construct absolute path to local claude executable
    const { resolve } = await import('path')
    const { fileURLToPath } = await import('url')
    const { existsSync } = await import('fs')
    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    const claudePath = resolve(__dirname, 'node_modules/.bin/claude')
    logger.info(`Using Claude executable: ${claudePath}`)

    // Check if claude executable exists
    if (!existsSync(claudePath)) {
      logger.error(`❌ Claude executable not found at: ${claudePath}`)
      logger.info('Checking alternative locations...')
      const altPath = resolve(__dirname, '../node_modules/.bin/claude')
      logger.info(`Alternative path: ${altPath} - exists: ${existsSync(altPath)}`)
    } else {
      logger.info(`✓ Claude executable found at: ${claudePath}`)
    }

    // Prepare environment for Claude Code
    // Convert custom proxy vars to standard HTTP_PROXY format if needed
    const claudeEnv = { ...process.env }
    if (process.env.PROXY_HOST && process.env.PROXY_USER && process.env.PROXY_PASS) {
      const proxyUrl = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}`
      claudeEnv.HTTP_PROXY = proxyUrl
      claudeEnv.HTTPS_PROXY = proxyUrl
      logger.info(`✓ Configured standard proxy environment variables for Claude Code`)
    }

    logger.info(`📋 Query options:`)
    logger.info(`  - permissionMode: acceptEdits`)
    logger.info(`  - claudePath: ${claudePath}`)
    logger.info(`  - cwd: ..`)
    logger.info(`  - allowedTools: Bash, Read, Glob, Grep, Write`)
    logger.info(`  - ANTHROPIC_API_KEY set: ${!!claudeEnv.ANTHROPIC_API_KEY}`)

    const iterator = query({
      prompt,
      options: {
        permissionMode: 'acceptEdits',
        systemPrompt: 'You are a code evaluation assistant. Your job is to explore codebases, analyze task feasibility, and create structured evaluation reports. Always use the Write tool to create files - never just describe what files should contain. Be thorough in your analysis and concrete in your recommendations.',
        env: claudeEnv,
        pathToClaudeCodeExecutable: claudePath,
        cwd: '..',
        allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write'],
        stderr: (data: string) => {
          logger.error(`[Claude Code stderr] ${data}`)
        },
      },
    })

    logger.info('✓ Query iterator created, starting iteration...')

    for await (const chunk of iterator) {
      iterations++
      logger.info(`📥 Iteration ${iterations}: chunk type = ${chunk.type}`)

      if (chunk.type === 'system') {
        logger.info(`[System] subtype=${chunk.subtype}`)
        if ('message' in chunk) {
          logger.info(`[System] message=${JSON.stringify(chunk.message)}`)
        }
      }

      if (chunk.type === 'assistant') {
        const message = JSON.stringify(chunk.message)
        logger.info(`[Assistant] ${message}`)
      }

      if (chunk.type === 'stream_event') {
        logger.info(`[Stream] event=${JSON.stringify(chunk.event)}`)
      }

      if (chunk.type === 'result') {
        const cost = chunk.total_cost_usd || 0
        logger.info(`✓ Claude Agent completed - Cost: $${cost.toFixed(4)}, Iterations: ${iterations}`)

        // Track agentic evaluation usage
        const agenticUsage = {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          goal: 'evaluation',
          phase: 'agentic_eval',
          input_tokens: chunk.usage?.input_tokens || 0,
          output_tokens: chunk.usage?.output_tokens || 0,
          cache_creation_input_tokens: chunk.usage?.cache_creation_input_tokens || 0,
          cache_read_input_tokens: chunk.usage?.cache_read_input_tokens || 0,
          ci_duration_seconds: Math.floor((Date.now() - agenticStart) / 1000),
          iteration_number: iterations,
          metadata: { iterations, sdk_cost_usd: cost }
        }

        await writeFile(
          '../results/agentic-usage.json',
          JSON.stringify(agenticUsage, null, 2),
          'utf-8'
        )
        logger.info('📊 Agentic evaluation usage tracked')
      }
    }

    logger.info('✓ Claude Agent SDK execution completed')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error(`❌ Claude Agent SDK error: ${errorMsg}`)
    if (errorStack) {
      logger.error(`Stack trace:\n${errorStack}`)
    }
    logger.error(`Total iterations before failure: ${iterations}`)

    throw new Error(`Claude Agent SDK execution failed: ${errorMsg}`)
  }

  // Read the files created by the agent
  const { readFile, readdir } = await import('fs/promises')

  try {
    // First, check what files were actually created
    logger.info('Checking results directory...')
    try {
      const files = await readdir('../results')
      logger.info(`Files in results directory: ${files.join(', ')}`)
    } catch {
      logger.error('Results directory not found or empty')
    }

    const verdictJson = await readFile('../results/agentic-verdict.json', 'utf-8')
    const verdict = JSON.parse(verdictJson)

    const report = await readFile('../results/evaluation-report.md', 'utf-8')

    logger.info(`✓ Agentic evaluation: can_implement=${verdict.can_implement}, confidence=${verdict.confidence}`)
    return { verdict, report }
  } catch (readError) {
    logger.error('Failed to read agent-created files')
    throw new Error(`Failed to read evaluation files: ${readError instanceof Error ? readError.message : String(readError)}`)
  }
}

async function main() {
  logger.info('🤖 Evaluation Pipeline Started')

  try {
    // Validate environment
    const env = validateEnvironment([
      'SESSION_ID',
      'PIPELINE_EXECUTION_ID',
      'API_BASE_URL',
      'API_TOKEN',
      'ANTHROPIC_API_KEY',
    ] as const)

    const sessionId = env.SESSION_ID
    const executionId = env.PIPELINE_EXECUTION_ID

    logger.info(`Session ID: ${sessionId}`)
    logger.info(`Execution ID: ${executionId}`)

    const apiClient = new ApiClient(env.API_BASE_URL, env.API_TOKEN)

    // Fetch session and task via API
    logger.info('📥 Fetching session from API...')
    const session = await apiClient.getSession(env.SESSION_ID)
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

    // Phase 2: Deep Agentic Evaluation (agent creates files directly)
    await agenticEvaluation(task, { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY })

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
