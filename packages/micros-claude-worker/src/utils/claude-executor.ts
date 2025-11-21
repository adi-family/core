/**
 * Claude executor utility
 * Handles execution of Claude Code CLI or Agent SDK
 */

import { createLogger } from '@utils/logger'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { ALLOWED_CLAUDE_TOOLS } from '@config/shared'

const logger = createLogger({ namespace: 'claude-executor' })

export interface ClaudeExecutionResult {
  output: string
  errors: string[]
  cost: number
  iterations: number
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens: number
    cache_read_input_tokens: number
  }
}

export interface ClaudeExecutionOptions {
  prompt: string
  workspacePath: string
  apiKey: string
  model?: string
  allowedTools?: string[]
}

/**
 * Find Claude Code executable path
 */
function getClaudePath(): string | null {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''

  // Try native installer locations
  const nativeInstallerPaths = [
    resolve(homeDir, '.local/bin/claude'),
    resolve(homeDir, '.local/share/claude-code/claude'),
  ]

  for (const path of nativeInstallerPaths) {
    if (existsSync(path)) {
      logger.info(`✓ Claude executable found at: ${path}`)
      return path
    }
  }

  // Try global npm locations
  const globalPaths = [
    '/usr/local/bin/claude',
    '/usr/bin/claude',
  ]

  for (const path of globalPaths) {
    if (existsSync(path)) {
      logger.info(`✓ Claude executable found at: ${path}`)
      return path
    }
  }

  logger.warn('Claude Code executable not found')
  return null
}

/**
 * Execute Claude using Agent SDK
 */
export async function executeClaudeAgent(
  options: ClaudeExecutionOptions
): Promise<ClaudeExecutionResult> {
  const errors: string[] = []
  let output = ''
  let cost = 0
  let iterations = 0
  let usage: any = undefined

  logger.info('🤖 Starting Claude Agent SDK...')
  logger.info(`Workspace: ${options.workspacePath}`)
  logger.info(`Model: ${options.model || 'default'}`)

  const claudePath = getClaudePath()
  if (!claudePath) {
    logger.warn('Claude Code executable not found, will use basic SDK mode')
  }

  try {
    const allowedTools = options.allowedTools || ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']

    logger.info(`Allowed tools: ${allowedTools.join(', ')}`)

    const iterator = query({
      prompt: options.prompt,
      options: {
        permissionMode: 'acceptEdits',
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: options.apiKey,
        },
        executable: 'node',
        cwd: options.workspacePath,
        allowedTools,
        pathToClaudeCodeExecutable: claudePath || undefined,
        stderr: (data: string) => {
          logger.error(`[Claude stderr] ${data}`)
        },
      },
    })

    logger.info('✓ Query iterator created, starting iteration...')

    for await (const chunk of iterator) {
      iterations++
      logger.info(`📥 Iteration ${iterations}: type=${chunk.type}`)

      if (chunk.type === 'system') {
        logger.info(`[System] subtype=${chunk.subtype}`)
      }

      if (chunk.type === 'assistant') {
        const message = JSON.stringify(chunk.message)
        logger.info(`[Assistant] ${message.substring(0, 200)}...`)
        output += `${message}\n`
      }

      if (chunk.type === 'result') {
        cost = chunk.total_cost_usd || 0
        const resultText = ('result' in chunk ? chunk?.result : undefined) || 'No result available'
        output += `\n\nFinal Result: ${resultText}`

        usage = {
          input_tokens: chunk.usage?.input_tokens || 0,
          output_tokens: chunk.usage?.output_tokens || 0,
          cache_creation_input_tokens: chunk.usage?.cache_creation_input_tokens || 0,
          cache_read_input_tokens: chunk.usage?.cache_read_input_tokens || 0,
        }

        logger.info(`✓ Claude Agent completed - Cost: $${cost.toFixed(4)}, Iterations: ${iterations}`)
      }
    }

    logger.info('✓ Claude Agent SDK execution completed')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Claude Agent SDK error: ${errorMsg}`)
    errors.push(errorMsg)
  }

  return {
    output,
    errors,
    cost,
    iterations,
    usage
  }
}

/**
 * Execute Claude for task evaluation (read-only analysis)
 */
export async function executeEvaluation(
  options: ClaudeExecutionOptions
): Promise<ClaudeExecutionResult> {
  logger.info('📊 Executing evaluation with Claude...')

  // For evaluation, we use read-only tools
  const evalOptions = {
    ...options,
    allowedTools: ALLOWED_CLAUDE_TOOLS
  }

  return executeClaudeAgent(evalOptions)
}

/**
 * Execute Claude for task implementation (full access)
 */
export async function executeImplementation(
  options: ClaudeExecutionOptions
): Promise<ClaudeExecutionResult> {
  logger.info('🛠️  Executing implementation with Claude...')

  // For implementation, we use all tools
  return executeClaudeAgent(options)
}
