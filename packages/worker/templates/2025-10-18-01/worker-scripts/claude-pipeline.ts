#!/usr/bin/env bun
import { ApiClient } from './shared/api-client'
import { runCompletionCheck } from './shared/completion-check'
import { validateEnvironment } from './shared/env-validator'
import { mkdir, readdir, writeFile } from 'fs/promises'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'
import { createLogger } from './shared/logger'
import { basename } from 'path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { pushToFileSpaces } from './push-to-file-spaces'

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
 * and prepare it for implementation by creating a task-specific branch
 * @param path - Absolute path to the workspace directory
 * @param taskId - Task ID to create branch name (required for implementation)
 * @returns Workspace data including path, directory name, repository URL, and current branch
 */
async function processWorkspace(path: string, taskId?: string): Promise<WorkspaceData> {
  // Get remote repository URL
  const { stdout: remoteOutput } = await exec(`cd ${path} && git remote get-url origin`)
  const rep = remoteOutput.trim()

  // Extract directory name from path
  const dirName = basename(path)

  // If no taskId provided, just return current state (used for workspace discovery only)
  // NOTE: For actual implementation, taskId MUST be provided
  if (!taskId) {
    const { stdout: branchOutput } = await exec(`cd ${path} && git branch --show-current`)
    const branch = branchOutput.trim() || 'detached'
    return { path, dirName, rep, branch }
  }

  // Fetch latest changes
  logger.info(`  Fetching latest changes...`)
  await exec(`cd ${path} && git fetch origin`)

  // Detect default branch (main or master)
  let defaultBranch = 'main'
  try {
    await exec(`cd ${path} && git rev-parse --verify origin/main`)
  } catch {
    defaultBranch = 'master'
  }

  // Checkout default branch (from detached HEAD if needed)
  logger.info(`  Checking out ${defaultBranch}...`)
  await exec(`cd ${path} && git checkout ${defaultBranch}`)
  await exec(`cd ${path} && git pull origin ${defaultBranch}`)

  // Create task-specific branch
  const taskBranch = `adi/task-${taskId}`
  logger.info(`  Creating task branch: ${taskBranch}`)

  try {
    // Delete branch if it exists (in case of retry)
    await exec(`cd ${path} && git branch -D ${taskBranch} 2>/dev/null || true`)
  } catch {
    // Ignore errors if branch doesn't exist
  }

  await exec(`cd ${path} && git checkout -b ${taskBranch}`)
  logger.info(`  ✓ Ready on branch: ${taskBranch}`)

  return {
    path,
    dirName,
    rep,
    branch: taskBranch,
  }
}

/**
 * Execute Claude Agent SDK with the given prompt and workspace
 * @param prompt - The prompt to send to Claude
 * @param workspacePath - Path to the workspace directory
 * @param env - Environment variables
 * @param workspaces - Array of workspace data for mock mode
 * @returns Object containing output, errors, cost, and iterations
 */
async function executeClaudeAgent(
  prompt: string,
  workspacePath: string,
  env: Record<string, string>,
  workspaces?: WorkspaceData[]
): Promise<{ output: string; errors: string[]; cost: number; iterations: number }> {
  const errors: string[] = []
  let output = ''
  let cost = 0
  let iterations = 0
  const implementationStart = Date.now()

  // Check for MOCK_MODE environment variable
  if (process.env.MOCK_MODE === 'true') {
    logger.info('🎭 MOCK MODE ENABLED - Returning mock data instead of real AI calls')

    // Generate mock data
    const mockOutput = {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Mock implementation completed for task:\n\n${prompt.substring(0, 200)}...\n\nThis is a mock response generated without calling the real Claude API. The task would be processed here.`
          }
        ]
      }
    }

    output = JSON.stringify(mockOutput) + '\n'
    output += `\n\nFinal Result: Mock implementation completed successfully`
    iterations = 1
    cost = 0.0001 // Mock minimal cost

    // Make changes to README.md in each workspace for testing
    if (workspaces && workspaces.length > 0) {
      logger.info('📝 Making test changes to README.md in workspaces...')
      for (const workspace of workspaces) {
        try {
          const readmePath = `${workspace.path}/README.md`
          const { stdout: readmeContent } = await exec(`cat "${readmePath}" 2>/dev/null || echo "# README"`)
          const timestamp = new Date().toISOString()
          const updatedContent = readmeContent.trim() + `\n\n<!-- Mock test change: ${timestamp} -->\n`
          await writeFile(readmePath, updatedContent, 'utf-8')
          logger.info(`  ✓ Updated ${workspace.dirName}/README.md`)
        } catch (error) {
          logger.warn(`  ⚠️  Could not update ${workspace.dirName}/README.md: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } else {
      logger.warn('  ⚠️  No workspaces provided to mock mode, skipping file changes')
    }

    // Create mock usage data
    const implementationUsage = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      goal: 'implementation',
      phase: 'implementation',
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      ci_duration_seconds: 1,
      iteration_number: iterations,
      metadata: { iterations, sdk_cost_usd: cost, mock: true }
    }

    await writeFile(
      '../results/implementation-usage.json',
      JSON.stringify(implementationUsage, null, 2),
      'utf-8'
    )
    logger.info('📊 Mock implementation usage tracked')
    logger.info('✓ Mock mode execution completed')

    return { output, errors, cost, iterations }
  }

  try {
    logger.info('🤖 Starting Claude Agent SDK...')

    logger.info(`📋 Query options:`)
    logger.info(`  - permissionMode: acceptEdits`)
    logger.info(`  - executable: bun`)
    logger.info(`  - cwd: ${workspacePath}`)
    logger.info(`  - allowedTools: Bash, Read, Write, Edit, Glob, Grep`)
    logger.info(`  - ANTHROPIC_API_KEY set: ${!!env.ANTHROPIC_API_KEY}`)

    const iterator = query({
      prompt,
      options: {
        permissionMode: 'acceptEdits',
        env: {
          ...process.env,
          ...env,
        },
        executable: 'bun',
        cwd: workspacePath,
        allowedTools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'],
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
        output += message + '\n'
      }

      if (chunk.type === 'stream_event') {
        logger.info(`[Stream] event=${JSON.stringify(chunk.event)}`)
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

    // Validate task has an ID
    if (!task.id) {
      throw new Error('Task has no ID - cannot create implementation branch')
    }

    // Update task status to 'implementing' now that worker is actually starting
    logger.info('📝 Updating task status to implementing...')
    await apiClient.updateTaskImplementationStatus(task.id, 'implementing')
    logger.info('✓ Task status updated to implementing')

    // Read available workspaces from disk (already synced as git submodules)
    const workspacesPath = '../workspaces'
    const workspaces = await processWorkspaces(workspacesPath)
    const availableWorkspaces = workspaces.map(ws => ws.dirName)

    // Prepare workspaces for implementation (create task branches)
    logger.info('\n🔧 Preparing workspaces for implementation...')
    for (const ws of workspaces) {
      logger.info(`\n📦 Preparing: ${ws.dirName}`)
      await processWorkspace(ws.path, task.id)
    }

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
      { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY },
      workspaces  // Pass workspaces for mock mode
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

    // Push changes to file spaces and create merge requests
    let pushResult = null
    try {
      logger.info('🚀 Pushing changes to file spaces...')
      pushResult = await pushToFileSpaces()
      logger.info(`✓ Push completed: ${pushResult.mergeRequests.length} MR(s) created`)
    } catch (error) {
      logger.error('❌ Failed to push to file spaces:', error)
      logger.error(error instanceof Error ? error.message : String(error))
      // Continue even if push fails - we'll save results anyway
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
          clarificationCheck: {
            needsClarification: false,
          },
          pushResult,
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
