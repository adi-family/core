#!/usr/bin/env bun
/**
 * Gemini Pipeline Runner
 * Executes Google Gemini agent on tasks
 */

import { ApiClient } from './shared/api-client'
import { runCompletionCheck } from './shared/completion-check'
import { runClarificationCheck } from './shared/clarification-check'
import { validateEnvironment } from './shared/env-validator'
import { mkdir, readdir, writeFile } from 'fs/promises'
import { createLogger } from './shared/logger'
import { cloneWorkspaces } from './shared/workspace-cloner'
import { pushToFileSpaces } from './push-to-file-spaces'
import { basename, resolve } from 'path'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'gemini-pipeline' })
const RESULTS_DIR = '2025-10-18-01/results'

interface WorkspaceData {
  path: string;
  dirName: string;
  rep: string;
  branch: string;
}

/**
 * Process all workspace directories and extract git repository information
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
 */
async function processWorkspace(path: string, taskId?: string): Promise<WorkspaceData> {
  const { stdout: remoteOutput } = await exec(`cd ${path} && git remote get-url origin`)
  const rep = remoteOutput.trim()
  const dirName = basename(path)

  if (!taskId) {
    const { stdout: branchOutput } = await exec(`cd ${path} && git branch --show-current`)
    const branch = branchOutput.trim() || 'detached'
    return { path, dirName, rep, branch }
  }

  const { stdout: currentBranch } = await exec(`cd ${path} && git rev-parse --abbrev-ref HEAD`)
  const baseBranch = currentBranch.trim()

  logger.info(`  Base branch: ${baseBranch}`)
  logger.info(`  Fetching latest changes...`)
  await exec(`cd ${path} && git fetch origin`)

  const taskBranch = `adi/task-${taskId}`
  let taskBranchExists = false

  try {
    await exec(`cd ${path} && git rev-parse --verify origin/${taskBranch}`)
    taskBranchExists = true
    logger.info(`  Found existing task branch: ${taskBranch}`)
  } catch {
    logger.info(`  Task branch does not exist yet: ${taskBranch}`)
  }

  if (taskBranchExists) {
    logger.info(`  Checking out existing task branch: ${taskBranch}`)
    try {
      await exec(`cd ${path} && git checkout ${taskBranch}`)
    } catch {
      await exec(`cd ${path} && git checkout -b ${taskBranch} origin/${taskBranch}`)
    }
    logger.info(`  Pulling latest changes from task branch...`)
    await exec(`cd ${path} && git pull origin ${taskBranch}`)
    logger.info(`  ✓ Resumed on branch: ${taskBranch}`)
  } else {
    logger.info(`  Pulling latest changes from base branch: ${baseBranch}...`)
    await exec(`cd ${path} && git pull origin ${baseBranch}`)
    logger.info(`  Creating new task branch: ${taskBranch}`)
    await exec(`cd ${path} && git checkout -b ${taskBranch}`)
    logger.info(`  ✓ Ready on new branch: ${taskBranch}`)
  }

  return { path, dirName, rep, branch: taskBranch }
}

/**
 * Execute Google Gemini agent with the given prompt and workspace
 */
async function executeGeminiAgent(
  prompt: string,
  workspacePath: string,
  apiKey: string,
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

    const mockOutput = {
      type: 'completion',
      model: 'gemini-1.5-pro',
      candidates: [{
        content: {
          role: 'model',
          parts: [{
            text: `Mock Gemini implementation completed for task:\n\n${prompt.substring(0, 200)}...\n\nThis is a mock response generated without calling the real Google Gemini API.`
          }]
        }
      }]
    }

    output = `${JSON.stringify(mockOutput)}\n`
    output += `\n\nFinal Result: Mock Gemini implementation completed successfully`
    iterations = 1
    cost = 0.0001

    // Make test changes to README.md in each workspace
    if (workspaces && workspaces.length > 0) {
      logger.info('📝 Making test changes to README.md in workspaces...')
      for (const workspace of workspaces) {
        try {
          const readmePath = `${workspace.path}/README.md`
          const { stdout: readmeContent } = await exec(`cat "${readmePath}" 2>/dev/null || echo "# README"`)
          const timestamp = new Date().toISOString()
          const updatedContent = `${readmeContent.trim()}\n\n<!-- Gemini mock test change: ${timestamp} -->\n`
          await writeFile(readmePath, updatedContent, 'utf-8')
          logger.info(`  ✓ Updated ${workspace.dirName}/README.md`)
        } catch (error) {
          logger.warn(`  ⚠️  Could not update ${workspace.dirName}/README.md: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    const implementationUsage = {
      provider: 'google',
      model: 'gemini-1.5-pro',
      goal: 'implementation',
      phase: 'implementation',
      input_tokens: 1000,
      output_tokens: 500,
      ci_duration_seconds: 1,
      iteration_number: iterations,
      metadata: { iterations, sdk_cost_usd: cost, mock: true }
    }

    await writeFile(
      `${RESULTS_DIR}/implementation-usage.json`,
      JSON.stringify(implementationUsage, null, 2),
      'utf-8'
    )
    logger.info('📊 Mock implementation usage tracked')
    logger.info('✓ Mock mode execution completed')

    return { output, errors, cost, iterations }
  }

  try {
    logger.info('🤖 Starting Google Gemini Agent...')
    logger.info(`  - API Key set: ${!!apiKey}`)
    logger.info(`  - Model: ${process.env.GOOGLE_MODEL || 'gemini-1.5-pro'}`)
    logger.info(`  - Workspace: ${workspacePath}`)

    // Import Google Generative AI SDK dynamically
    const { GoogleGenerativeAI } = await import('@google/generative-ai')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = process.env.GOOGLE_MODEL || 'gemini-1.5-pro'
    const geminiModel = genAI.getGenerativeModel({ model })

    logger.info(`✓ Google Gemini client initialized with model: ${model}`)

    // Configure generation parameters
    const generationConfig = {
      temperature: parseFloat(process.env.GOOGLE_TEMPERATURE || '0.7'),
      maxOutputTokens: parseInt(process.env.GOOGLE_MAX_TOKENS || '8192'),
    }

    // Execute Gemini request
    logger.info('📤 Sending request to Google Gemini...')
    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    })

    const response = result.response
    iterations = 1
    const message = response.text() || 'No response'
    output = JSON.stringify(response) + '\n\nFinal Result: ' + message

    // Calculate cost (approximate - based on Gemini pricing)
    const inputTokens = response.usageMetadata?.promptTokenCount || 0
    const outputTokens = response.usageMetadata?.candidatesTokenCount || 0
    // Gemini 1.5 Pro pricing: $1.25/1M input tokens, $5/1M output tokens (approximate)
    cost = (inputTokens * 0.00000125) + (outputTokens * 0.000005)

    logger.info(`✓ Gemini Agent completed - Cost: $${cost.toFixed(4)}, Iterations: ${iterations}`)

    // Track implementation usage
    const implementationUsage = {
      provider: 'google',
      model,
      goal: 'implementation',
      phase: 'implementation',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      ci_duration_seconds: Math.floor((Date.now() - implementationStart) / 1000),
      iteration_number: iterations,
      metadata: { iterations, sdk_cost_usd: cost }
    }

    await writeFile(
      `${RESULTS_DIR}/implementation-usage.json`,
      JSON.stringify(implementationUsage, null, 2),
      'utf-8'
    )
    logger.info('📊 Implementation usage tracked')

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Gemini Agent error: ${errorMsg}`)
    errors.push(errorMsg)
  }

  return { output, errors, cost, iterations }
}

async function main() {
  logger.info('🤖 Gemini Pipeline Started')

  try {
    // Clone workspaces if FILE_SPACES is provided
    if (process.env.FILE_SPACES) {
      logger.info('📦 Cloning workspaces...')
      await cloneWorkspaces()
      logger.info('✅ Workspaces cloned successfully')
    }

    // Validate environment
    const env = validateEnvironment([
      'SESSION_ID',
      'PIPELINE_EXECUTION_ID',
      'API_BASE_URL',
      'API_TOKEN',
      'GOOGLE_API_KEY',
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

    if (!task.id) {
      throw new Error('Task has no ID - cannot create implementation branch')
    }

    // Update task status to 'implementing'
    logger.info('📝 Updating task status to implementing...')
    await apiClient.updateTaskImplementationStatus(task.id, 'implementing')
    logger.info('✓ Task status updated to implementing')

    // Read available workspaces from disk
    const workspacesPath = process.env.PIPELINE_EXECUTION_ID
      ? `/tmp/workspace-${process.env.PIPELINE_EXECUTION_ID}`
      : '../workspaces'

    const workspaces = await processWorkspaces(workspacesPath)
    const availableWorkspaces = workspaces.map(ws => ws.dirName)

    // Prepare workspaces for implementation (create task branches)
    logger.info('\n🔧 Preparing workspaces for implementation...')
    for (const ws of workspaces) {
      logger.info(`\n📦 Preparing: ${ws.dirName}`)
      await processWorkspace(ws.path, task.id)
    }

    // Create results directory
    await mkdir(RESULTS_DIR, { recursive: true })

    logger.info('🔧 Running Gemini agent...')
    logger.info(`Task: ${task.title}`)
    logger.info(`Description: ${task.description || 'N/A'}`)

    // Initialize agent results
    const agentResults: {
      exitCode: number;
      output: string;
      changes: Record<string, any>;
      errors: string[];
    } = {
      exitCode: 0,
      output: '',
      changes: {},
      errors: [],
    }

    // Build prompt with available workspaces context
    let workspaceContext = 'Available workspace repositories:\n'
    if (availableWorkspaces.length > 0) {
      for (const ws of availableWorkspaces) {
        workspaceContext += `- ${ws}/\n`
      }
    } else {
      workspaceContext += '(No workspaces configured)\n'
    }
    workspaceContext += '\n'

    const prompt = `${workspaceContext}${task.title}\n\n${task.description || ''}`

    // Execute Gemini Agent
    const { output, errors, cost, iterations } = await executeGeminiAgent(
      prompt,
      workspacesPath,
      env.GOOGLE_API_KEY,
      workspaces
    )
    agentResults.output = output
    agentResults.errors = errors
    agentResults.exitCode = errors.length > 0 ? 1 : 0

    logger.info(`💰 Total cost: $${cost.toFixed(4)}`)
    logger.info(`🔄 Total iterations: ${iterations}`)

    if (agentResults.exitCode !== 0) {
      throw new Error('Gemini Agent execution failed')
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
    } else {
      logger.info('✓ No clarification needed')
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
    }

    // Save results
    await Bun.write(
      `${RESULTS_DIR}/output.json`,
      JSON.stringify(
        {
          session,
          task,
          agentResults,
          completionCheck,
          clarificationCheck,
          pushResult,
        },
        null,
        2
      )
    )

    logger.info('✅ Gemini pipeline completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Gemini pipeline failed:', error)
    await Bun.write(
      `${RESULTS_DIR}/error.json`,
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

// Export for use in worker binary
export { main as geminiPipeline }

// Run if called directly (not from worker binary)
if (!process.env.__WORKER_BINARY__) {
  const isMainModule = import.meta.url === `file://${process.argv[1]}`
  if (isMainModule) {
    main()
  }
}
