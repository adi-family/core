/**
 * Gemini executor utility
 * Handles execution of Google Gemini models
 */

import { createLogger } from '@utils/logger'
import { GoogleGenerativeAI } from '@google/generative-ai'

const logger = createLogger({ namespace: 'gemini-executor' })

export interface GeminiExecutionResult {
  output: string
  errors: string[]
  cost: number
  iterations: number
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

export interface GeminiExecutionOptions {
  prompt: string
  workspacePath: string
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Execute Gemini using Google Generative AI SDK
 */
export async function executeGeminiAgent(
  options: GeminiExecutionOptions
): Promise<GeminiExecutionResult> {
  const errors: string[] = []
  let output = ''
  let cost = 0
  let iterations = 0
  let usage: any = undefined

  logger.info('🤖 Starting Google Gemini Agent...')
  logger.info(`Workspace: ${options.workspacePath}`)
  logger.info(`Model: ${options.model || 'gemini-1.5-pro'}`)

  try {
    const genAI = new GoogleGenerativeAI(options.apiKey)
    const model = options.model || 'gemini-1.5-pro'
    const geminiModel = genAI.getGenerativeModel({ model })

    logger.info(`✓ Google Gemini client initialized with model: ${model}`)

    // Configure generation parameters
    const generationConfig = {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 8192,
    }

    // Execute Gemini request
    logger.info('📤 Sending request to Google Gemini...')
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig,
    })

    const response = result.response
    iterations = 1
    output = response.text() || 'No response'

    // Calculate cost (approximate - based on Gemini pricing)
    const inputTokens = response.usageMetadata?.promptTokenCount || 0
    const outputTokens = response.usageMetadata?.candidatesTokenCount || 0
    // Gemini 1.5 Pro pricing: $1.25/1M input tokens, $5/1M output tokens (approximate)
    cost = (inputTokens * 0.00000125) + (outputTokens * 0.000005)

    usage = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    }

    logger.info(`✓ Gemini Agent completed - Cost: $${cost.toFixed(4)}, Iterations: ${iterations}`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Gemini Agent error: ${errorMsg}`)
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
 * Execute Gemini for task evaluation (read-only analysis)
 */
export async function executeEvaluation(
  options: GeminiExecutionOptions
): Promise<GeminiExecutionResult> {
  logger.info('📊 Executing evaluation with Gemini...')

  // For evaluation, we use a smaller context
  const evalOptions = {
    ...options,
    maxTokens: 4096
  }

  return executeGeminiAgent(evalOptions)
}

/**
 * Execute Gemini for task implementation
 */
export async function executeImplementation(
  options: GeminiExecutionOptions
): Promise<GeminiExecutionResult> {
  logger.info('🛠️  Executing implementation with Gemini...')

  return executeGeminiAgent(options)
}
