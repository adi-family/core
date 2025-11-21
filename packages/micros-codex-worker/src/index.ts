/**
 * Codex Worker Microservice
 * Consumes tasks from RabbitMQ and executes them using OpenAI Codex
 */

import { WorkerClient, type TaskHandler, type WorkerTaskMessage } from '@adi-simple/worker-sdk'
import { createLogger } from '@utils/logger'
import { cloneWorkspaces, createTaskBranch, type WorkspaceConfig } from './utils/workspace-cloner'
import { executeEvaluation, executeImplementation } from './utils/codex-executor'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'codex-worker' })

// Environment configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost'
const WORKER_NAME = process.env.WORKER_NAME || 'codex-worker'
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '3', 10)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const WORKER_VERSION = '1.0.0'

/**
 * Get OpenAI API key from task context or environment
 */
function getApiKey(task: WorkerTaskMessage): string {
  const aiProvider = task.context.aiProvider || {}
  const openaiConfig = aiProvider.openai || {}
  const apiKey = openaiConfig.apiKey || OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('No OpenAI API key configured')
  }

  return apiKey
}

/**
 * Get model from task context or use default
 */
function getModel(task: WorkerTaskMessage): string {
  const aiProvider = task.context.aiProvider || {}
  const openaiConfig = aiProvider.openai || {}
  return openaiConfig.model || 'gpt-4-turbo'
}

/**
 * Parse workspace configuration from task context
 */
function parseWorkspaceConfig(task: WorkerTaskMessage): WorkspaceConfig[] {
  const workspace = task.context.workspace as any
  if (!workspace || !workspace.repositories) {
    return []
  }

  const repositories = workspace.repositories
  if (!Array.isArray(repositories)) {
    return []
  }

  return repositories.map((repo: any) => ({
    name: repo.name || 'workspace',
    repo: repo.url || repo.repo,
    branch: repo.branch,
    token: repo.token
  }))
}

/**
 * Execute task evaluation using Codex
 */
async function evaluateTask(task: WorkerTaskMessage): Promise<any> {
  logger.info(`Evaluating task ${task.taskId}: ${task.context.task.title}`)

  const apiKey = getApiKey(task)
  const model = getModel(task)
  const workspaceConfigs = parseWorkspaceConfig(task)

  // Create temporary directory for workspaces
  const tempDir = await mkdtemp(join(tmpdir(), 'codex-eval-'))
  logger.info(`Created temp directory: ${tempDir}`)

  try {
    // Clone workspaces if configured
    let workspaces: Awaited<ReturnType<typeof cloneWorkspaces>> = []
    let workspaceContext = ''

    if (workspaceConfigs.length > 0) {
      logger.info(`Cloning ${workspaceConfigs.length} workspace(s)...`)
      workspaces = await cloneWorkspaces(workspaceConfigs, tempDir)

      workspaceContext = 'Available workspace repositories:\n'
      for (const ws of workspaces) {
        workspaceContext += `- ${ws.name}/ (${ws.branch})\n`
      }
      workspaceContext += '\n'
    } else {
      logger.info('No workspaces configured for this task')
      workspaceContext = '(No workspaces configured)\n\n'
    }

    // Build evaluation prompt
    const evaluationPrompt = `${workspaceContext}Analyze the following task and determine if it can be implemented:

Task: ${task.context.task.title}
Description: ${task.context.task.description || 'No description provided'}

Please evaluate:
1. Can this task be implemented by AI?
2. What is the estimated complexity (xs, s, m, l, xl)?
3. What are the required context files?
4. What are suggested implementation steps?
5. What risks or blockers exist?

Provide your analysis as a structured evaluation.`

    // Execute Codex evaluation
    const result = await executeEvaluation({
      prompt: evaluationPrompt,
      workspacePath: workspaces[0]?.path || tempDir,
      apiKey,
      model
    })

    if (result.errors.length > 0) {
      logger.error(`Evaluation errors: ${result.errors.join(', ')}`)
      throw new Error(`Evaluation failed: ${result.errors[0]}`)
    }

    logger.info(`Evaluation completed - Cost: $${result.cost.toFixed(4)}, Iterations: ${result.iterations}`)

    return {
      canImplement: true,
      estimatedComplexity: 'medium',
      evaluation: result.output,
      cost: result.cost,
      iterations: result.iterations,
      usage: result.usage
    }
  } finally {
    // Cleanup temp directory
    logger.info('Cleaning up temp directory...')
    await rm(tempDir, { recursive: true, force: true })
  }
}

/**
 * Execute task implementation using Codex
 */
async function implementTask(task: WorkerTaskMessage): Promise<any> {
  logger.info(`Implementing task ${task.taskId}: ${task.context.task.title}`)

  const apiKey = getApiKey(task)
  const model = getModel(task)
  const workspaceConfigs = parseWorkspaceConfig(task)

  if (workspaceConfigs.length === 0) {
    throw new Error('No workspaces configured for implementation')
  }

  // Create temporary directory for workspaces
  const tempDir = await mkdtemp(join(tmpdir(), 'codex-impl-'))
  logger.info(`Created temp directory: ${tempDir}`)

  try {
    // Clone workspaces
    logger.info(`Cloning ${workspaceConfigs.length} workspace(s)...`)
    const workspaces = await cloneWorkspaces(workspaceConfigs, tempDir)

    // Create task-specific branches
    logger.info('Creating task-specific branches...')
    for (const ws of workspaces) {
      await createTaskBranch(ws.path, task.taskId)
    }

    // Build workspace context
    let workspaceContext = 'Available workspace repositories:\n'
    for (const ws of workspaces) {
      workspaceContext += `- ${ws.name}/\n`
    }
    workspaceContext += '\n'

    // Build implementation prompt
    const implementationPrompt = `${workspaceContext}${task.context.task.title}

${task.context.task.description || ''}

Please implement this task in the appropriate workspace(s).`

    // Execute Codex implementation
    const result = await executeImplementation({
      prompt: implementationPrompt,
      workspacePath: workspaces[0]?.path || tempDir,
      apiKey,
      model
    })

    if (result.errors.length > 0) {
      logger.error(`Implementation errors: ${result.errors.join(', ')}`)
      throw new Error(`Implementation failed: ${result.errors[0]}`)
    }

    logger.info(`Implementation completed - Cost: $${result.cost.toFixed(4)}, Iterations: ${result.iterations}`)

    // Collect changed files
    const filesModified: string[] = []
    for (const ws of workspaces) {
      try {
        const { stdout } = await exec(`cd "${ws.path}" && git status --porcelain`)
        if (stdout.trim()) {
          const files = stdout.trim().split('\n').map(line => {
            const parts = line.trim().split(/\s+/)
            return `${ws.name}/${parts[1]}`
          })
          filesModified.push(...files)
        }

        // Push changes to remote
        logger.info(`Pushing changes for ${ws.name}...`)
        const taskBranch = `adi/task-${task.taskId}`

        // Configure git
        await exec(`cd "${ws.path}" && git config user.name "ADI Codex Worker"`)
        await exec(`cd "${ws.path}" && git config user.email "worker@adi-simple.com"`)

        // Commit changes
        await exec(`cd "${ws.path}" && git add -A`)
        await exec(`cd "${ws.path}" && git commit -m "Implement: ${task.context.task.title}"`)

        // Push to remote
        await exec(`cd "${ws.path}" && git push origin ${taskBranch}`)
        logger.info(`✓ Pushed changes to ${taskBranch}`)
      } catch (error) {
        logger.warn(`Failed to process changes for ${ws.name}: ${error}`)
      }
    }

    return {
      status: 'completed',
      summary: result.output.substring(0, 500),
      filesModified,
      cost: result.cost,
      iterations: result.iterations,
      usage: result.usage,
      testsPassed: false // TODO: Run tests
    }
  } finally {
    // Cleanup temp directory
    logger.info('Cleaning up temp directory...')
    await rm(tempDir, { recursive: true, force: true })
  }
}

/**
 * Task handler implementation
 */
const handler: TaskHandler = {
  async onEvaluate(task: WorkerTaskMessage): Promise<any> {
    const startTime = Date.now()
    try {
      const result = await evaluateTask(task)
      return {
        ...result,
        executionTimeMs: Date.now() - startTime,
        workerVersion: WORKER_VERSION
      }
    } catch (error) {
      logger.error(`Evaluation failed: ${error}`)
      throw error
    }
  },

  async onImplement(task: WorkerTaskMessage): Promise<any> {
    const startTime = Date.now()
    try {
      const result = await implementTask(task)
      return {
        ...result,
        executionTimeMs: Date.now() - startTime,
        workerVersion: WORKER_VERSION
      }
    } catch (error) {
      logger.error(`Implementation failed: ${error}`)
      throw error
    }
  },

  async onCancel(sessionId: string): Promise<void> {
    logger.info(`Cancelling session ${sessionId}`)
    // TODO: Implement cancellation logic
  }
}

/**
 * Main entry point
 */
async function main() {
  logger.info('===========================================')
  logger.info('  Codex Worker Microservice')
  logger.info('===========================================')
  logger.info(`Worker Name: ${WORKER_NAME}`)
  logger.info(`Worker Version: ${WORKER_VERSION}`)
  logger.info(`RabbitMQ URL: ${RABBITMQ_URL}`)
  logger.info(`Max Concurrency: ${MAX_CONCURRENCY}`)
  logger.info('===========================================\n')

  // Validate required configuration
  if (!OPENAI_API_KEY) {
    logger.warn('⚠️  OPENAI_API_KEY not set - tasks must provide their own API keys')
  }

  const client = new WorkerClient({
    rabbitmqUrl: RABBITMQ_URL,
    workerName: WORKER_NAME,
    concurrency: MAX_CONCURRENCY
  })

  try {
    // Connect to RabbitMQ
    await client.connect()

    // Start listening for tasks
    await client.listen(handler)

    logger.info('✓ Worker is running and ready to process tasks\n')

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`\nReceived ${signal}, shutting down gracefully...`)
      logger.info(`Active tasks: ${client.getActiveTaskCount()}`)
      await client.close()
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

  } catch (error) {
    logger.error('Failed to start Codex worker:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  logger.error('Unhandled error in main:', error)
  process.exit(1)
})
