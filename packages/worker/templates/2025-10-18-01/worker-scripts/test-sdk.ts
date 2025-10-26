#!/usr/bin/env bun
/**
 * Test script for Claude Agent SDK integration
 * Tests if the SDK can spawn Claude Code process correctly
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { createLogger } from './shared/logger'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const logger = createLogger({ namespace: 'test-sdk' })

async function testSDK() {
  logger.info('🧪 Testing Claude Agent SDK...')
  logger.info(`API Key present: ${!!process.env.ANTHROPIC_API_KEY}`)
  logger.info(`Working directory: ${process.cwd()}`)

  // Set timeout to prevent hanging
  const timeout = setTimeout(() => {
    logger.error('❌ Test timed out after 20 seconds')
    process.exit(1)
  }, 20000)

  try {
    // Construct absolute path to local claude executable
    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    const claudePath = resolve(__dirname, 'node_modules/.bin/claude')
    logger.info(`Using Claude executable: ${claudePath}`)

    // Test with a simple prompt
    const prompt = 'List files in current directory using ls command'

    logger.info('Starting SDK query...')
    logger.info(`CWD: ${process.cwd()}`)
    logger.info(`ANTHROPIC_API_KEY present: ${!!process.env.ANTHROPIC_API_KEY}`)

    const iterator = query({
      prompt,
      options: {
        permissionMode: 'acceptEdits',
        env: process.env,
        pathToClaudeCodeExecutable: claudePath,
        cwd: process.cwd(),
        allowedTools: ['Bash'],
        stderr: (data: string) => {
          logger.error(`[Claude stderr] ${data}`)
        },
      },
    })

    let iterations = 0
    logger.info('Waiting for SDK response...')

    for await (const chunk of iterator) {
      iterations++
      logger.info(`[Iteration ${iterations}] Type: ${chunk.type}`)

      if (chunk.type === 'assistant') {
        logger.info(`[Assistant] ${JSON.stringify(chunk.message).substring(0, 200)}`)
      }

      if (chunk.type === 'system') {
        logger.info(`[System] ${JSON.stringify(chunk)}`)
      }

      if (chunk.type === 'result') {
        clearTimeout(timeout)
        logger.info(`✅ SDK test completed successfully! Iterations: ${iterations}`)
        process.exit(0)
      }
    }

    clearTimeout(timeout)
    logger.warn('Iterator finished without result')
    process.exit(1)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error(`❌ SDK test failed: ${errorMsg}`)
    if (errorStack) {
      logger.error(`Stack trace:\n${errorStack}`)
    }

    process.exit(1)
  }
}

testSDK()
