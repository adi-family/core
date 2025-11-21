/**
 * Codex executor utility
 * Handles execution of OpenAI Codex models
 */

import { createLogger } from '@utils/logger'
import OpenAI from 'openai'

const logger = createLogger({ namespace: 'codex-executor' })

export interface CodexExecutionResult {
  output: string
  errors: string[]
  cost: number
  iterations: number
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

export interface CodexExecutionOptions {
  prompt: string
  workspacePath: string
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Execute Codex using OpenAI SDK
 */
export async function executeCodexAgent(
  options: CodexExecutionOptions
): Promise<CodexExecutionResult> {
  const errors: string[] = []
  let output = ''
  let cost = 0
  let iterations = 0
  let usage: any = undefined

  logger.info('🤖 Starting OpenAI Codex Agent...')
  logger.info(`Workspace: ${options.workspacePath}`)
  logger.info(`Model: ${options.model || 'gpt-4-turbo'}`)

  try {
    const openai = new OpenAI({
      apiKey: options.apiKey,
      baseURL: process.env.OPENAI_API_BASE,
      organization: process.env.OPENAI_ORGANIZATION,
    })

    const model = options.model || 'gpt-4-turbo'
    logger.info(`✓ OpenAI client initialized with model: ${model}`)

    // Execute Codex request
    logger.info('📤 Sending request to OpenAI Codex...')
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert code assistant. Analyze the task and provide implementation guidance or code.'
        },
        {
          role: 'user',
          content: options.prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
    })

    iterations = 1
    const message = completion.choices[0]?.message?.content || 'No response'
    output = message

    // Calculate cost (approximate GPT-4 pricing)
    const inputTokens = completion.usage?.prompt_tokens || 0
    const outputTokens = completion.usage?.completion_tokens || 0
    cost = (inputTokens * 0.00001) + (outputTokens * 0.00003)

    usage = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    }

    logger.info(`✓ Codex Agent completed - Cost: $${cost.toFixed(4)}, Iterations: ${iterations}`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Codex Agent error: ${errorMsg}`)
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
 * Execute Codex for task evaluation (read-only analysis)
 */
export async function executeEvaluation(
  options: CodexExecutionOptions
): Promise<CodexExecutionResult> {
  logger.info('📊 Executing evaluation with Codex...')

  // For evaluation, we use a smaller context
  const evalOptions = {
    ...options,
    maxTokens: 2048
  }

  return executeCodexAgent(evalOptions)
}

/**
 * Execute Codex for task implementation
 */
export async function executeImplementation(
  options: CodexExecutionOptions
): Promise<CodexExecutionResult> {
  logger.info('🛠️  Executing implementation with Codex...')

  return executeCodexAgent(options)
}
