#!/usr/bin/env bun
import { ApiClient } from './shared/api-client'
import { runCompletionCheck } from './shared/completion-check'
import { runClarificationCheck } from './shared/clarification-check'
import { validateEnvironment } from './shared/env-validator'
import { mkdir, readdir, writeFile } from 'fs/promises'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'
import { createLogger } from './shared/logger'
import { basename } from 'path'
import { query } from '@anthropic-ai/claude-agent-sdk'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'claude-pipeline' })

interface WorkspaceData {
  path: string;
  dirName: string;
  rep: string;
  branch: string;
}

/**
 * Process all workspace directories and extract git repository information
 * @param workspacesDir - Path to the workspaces directory
 * @returns Array of workspace data objects
 */
async function processWorkspaces(workspacesDir: string): Promise<WorkspaceData[]> {
  const entries = await readdir(workspacesDir, { withFileTypes: true })
  const workspaceDirs = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => `${workspacesDir}/${entry.name}`)

  return await Promise.all(
    workspaceDirs.map(dir => processWorkspace(dir))
  )
}

/**
 * Process a single workspace directory to extract git repository information
 * @param path - Absolute path to the workspace directory
 * @returns Workspace data including path, directory name, repository URL, and current branch
 */
async function processWorkspace(path: string): Promise<WorkspaceData> {
  // Pull latest changes
  await exec(`cd ${path} && git pull`)

  // Get current branch name
  const { stdout: branchOutput } = await exec(`cd ${path} && git branch --show-current`)
  const branch = branchOutput.trim()

  // Get remote repository URL
  const { stdout: remoteOutput } = await exec(`cd ${path} && git remote get-url origin`)
  const rep = remoteOutput.trim()

  // Extract directory name from path
  const dirName = basename(path)

  return {
    path,
    dirName,
    rep,
    branch,
  }
}

/**
 * Execute Claude Agent SDK with the given prompt and workspace
 * @param prompt - The prompt to send to Claude
 * @param workspacePath - Path to the workspace directory
 * @param env - Environment variables
 * @returns Object containing output, errors, cost, and iterations
 */
async function executeClaudeAgent(
  prompt: string,
  workspacePath: string,
  env: Record<string, string>
): Promise<{ output: string; errors: string[]; cost: number; iterations: number }> {
  const errors: string[] = []
  let output = ''
  let cost = 0
  let iterations = 0
  const implementationStart = Date.now()

  try {
    logger.info('🤖 Starting Claude Agent SDK...')

    const iterator = query({
      prompt,
      options: {
        permissionMode: 'bypassPermissions',
        env: {
          ...process.env,
          ...env,
        },
        executable: 'bun',
        cwd: workspacePath,
        allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
      },
    })

    for await (const chunk of iterator) {
      iterations++

      if (chunk.type === 'system') {
        logger.info(`[System] ${JSON.stringify(chunk.subtype)}`)
      }

      if (chunk.type === 'assistant') {
        const message = JSON.stringify(chunk.message)
        logger.info(`[Assistant] ${message}`)
        output += message + '\n'
      }

      if (chunk.type === 'stream_event') {
        logger.info(`[Stream] ${JSON.stringify(chunk.event)}`)
      }

      if (chunk.type === 'result') {
        cost = chunk.total_cost_usd || 0
        const resultText = ('result' in chunk ? chunk?.result : undefined) || 'No result available'
        output += `\n\nFinal Result: ${resultText}`
        logger.info(`✓ Claude Agent completed - Cost: $${cost.toFixed(4)}, Iterations: ${iterations}`)

        // Track implementation usage
        const implementationUsage = {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          goal: 'implementation',
          phase: 'implementation',
          input_tokens: chunk.usage?.input_tokens || 0,
          output_tokens: chunk.usage?.output_tokens || 0,
          cache_creation_input_tokens: chunk.usage?.cache_creation_input_tokens || 0,
          cache_read_input_tokens: chunk.usage?.cache_read_input_tokens || 0,
          ci_duration_seconds: Math.floor((Date.now() - implementationStart) / 1000),
          iteration_number: iterations,
          metadata: { iterations, sdk_cost_usd: cost }
        }

        await writeFile(
          '../results/implementation-usage.json',
          JSON.stringify(implementationUsage, null, 2),
          'utf-8'
        )
        logger.info('📊 Implementation usage tracked')
      }
    }

    logger.info('✓ Claude Agent SDK execution completed')
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Claude Agent SDK error: ${errorMsg}`)
    errors.push(errorMsg)
  }

  return { output, errors, cost, iterations }
}

async function main() {
  logger.info('🤖 Claude Pipeline Started')

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
    const session = await apiClient.getSession(sessionId)
    logger.info(`✓ Session loaded: runner=${session.runner}`)

    if (!session.task_id) {
      throw new Error('Session has no associated task')
    }

    logger.info('📥 Fetching task from API...')
    const task = await apiClient.getTask(session.task_id)
    logger.info(`✓ Task loaded: ${task.title}`)

    // Read available workspaces from disk (already synced as git submodules)
    const workspacesPath = '../workspaces'
    const workspaces = await processWorkspaces(workspacesPath)
    const availableWorkspaces = workspaces.map(ws => ws.dirName)

    // Create results directory
    await mkdir('../results', { recursive: true })

    logger.info('🔧 Running Claude SDK...')
    logger.info(`Task: ${task.title}`)
    logger.info(`Description: ${task.description || 'N/A'}`)

    // Initialize agent results
    const agentResults = {
      exitCode: 0,
      output: '',
      changes: {},
      errors: [] as string[],
    }

    // Run Claude Code with available workspaces context
    logger.info('🤖 Executing Claude Code...')

    // Build prompt with all available workspaces context
    let workspaceContext = 'Available workspace repositories:\n'
    if (availableWorkspaces.length > 0) {
      for (const ws of availableWorkspaces) {
        workspaceContext += `- workspaces/${ws}/\n`
      }
    } else {
      workspaceContext += '(No workspaces configured)\n'
    }
    workspaceContext += '\n'

    const prompt = `${workspaceContext}${task.title}\n\n${task.description || ''}`

    // Execute Claude Agent SDK
    const { output, errors, cost, iterations } = await executeClaudeAgent(
      prompt,
      '..',  // Root directory
      { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }
    )
    agentResults.output = output
    agentResults.errors = errors
    agentResults.exitCode = errors.length > 0 ? 1 : 0

    logger.info(`💰 Total cost: $${cost.toFixed(4)}`)
    logger.info(`🔄 Total iterations: ${iterations}`)

    if (agentResults.exitCode !== 0) {
      throw new Error('Claude Agent SDK execution failed')
    }

    // Run completion check
    logger.info('✅ Running completion check...')
    const completionCheck = await runCompletionCheck(agentResults)
    if (!completionCheck.isComplete) {
      logger.warn(
        `⚠️  Completion check failed: ${completionCheck.reason} (confidence: ${completionCheck.confidence})`
      )
    } else {
      logger.info(
        `✓ Completion check passed (confidence: ${completionCheck.confidence})`
      )
    }

    // Run clarification check
    logger.info('❓ Running clarification check...')
    const clarificationCheck = await runClarificationCheck(agentResults)
    if (clarificationCheck.needsClarification) {
      logger.warn(
        `⚠️  Clarification needed: ${clarificationCheck.reason}`
      )
      if (clarificationCheck.questions) {
        for (const question of clarificationCheck.questions) {
          logger.info(`  - ${question}`)
        }
      }
    } else {
      logger.info('✓ No clarification needed')
    }

    // Save results for report stage
    await Bun.write(
      '../results/output.json',
      JSON.stringify(
        {
          session,
          task,
          agentResults,
          completionCheck,
          clarificationCheck,
        },
        null,
        2
      )
    )

    logger.info('✅ Claude pipeline completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Claude pipeline failed:', error)
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
