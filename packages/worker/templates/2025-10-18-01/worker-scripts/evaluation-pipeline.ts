#!/usr/bin/env bun
/**
 * Task Evaluation Pipeline Runner
 * Analyzes task feasibility using Claude AI with read-only code access
 */

import { ApiClient } from './shared/api-client'
import { validateEnvironment } from './shared/env-validator'
import { mkdir, writeFile } from 'fs/promises'
import { createLogger } from './shared/logger'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { readFile, readdir } from 'fs/promises'
import { cloneWorkspaces } from './shared/workspace-cloner'

const logger = createLogger({ namespace: 'evaluation-pipeline' })

/**
 * Workspace information
 */
interface WorkspaceInfo {
  dir: string
  name: string
  branch: string
}

/**
 * Evaluation result structure
 */
interface EvaluationResult {
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
}

/**
 * Handle mock mode - returns mock evaluation data
 */
async function handleMockMode(task: { title: string; description: string | null }): Promise<EvaluationResult> {
  logger.info('🎭 MOCK MODE ENABLED - Returning mock agentic evaluation')

  const mockVerdict = {
    can_implement: true,
    confidence: 80,
    agent_instructions: {
      required_context_files: ['src/example.ts:1-50', 'src/models/user.ts:10-30'],
      suggested_steps: [
        'Analyze existing implementation patterns',
        'Create new feature following established conventions',
        'Add appropriate tests'
      ],
      follow_patterns_from: ['src/features/similar-feature.ts:20-100']
    },
    missing_information: [],
    blockers: [],
    risks: ['Standard implementation risks apply']
  }

  const mockReport = `# Mock Evaluation Report

## Task
**Title:** ${task.title}
**Description:** ${task.description || 'No description'}

## Verdict
This is a mock evaluation report generated in MOCK_MODE.

### Can Implement
Yes (Confidence: 80%)

### Required Context Files
- src/example.ts:1-50
- src/models/user.ts:10-30

### Suggested Steps
1. Analyze existing implementation patterns
2. Create new feature following established conventions
3. Add appropriate tests

### Patterns to Follow
- src/features/similar-feature.ts:20-100

### Risks
- Standard implementation risks apply

---
*Generated in MOCK_MODE - no real codebase analysis performed*
`

  await writeFile('../results/agentic-verdict.json', JSON.stringify(mockVerdict, null, 2), 'utf-8')
  await writeFile('../results/evaluation-report.md', mockReport, 'utf-8')

  const agenticUsage = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    goal: 'evaluation',
    phase: 'agentic_eval',
    input_tokens: 2000,
    output_tokens: 800,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    ci_duration_seconds: 1,
    iteration_number: 1,
    metadata: { iterations: 1, sdk_cost_usd: 0.0001, mock: true }
  }

  await writeFile('../results/agentic-usage.json', JSON.stringify(agenticUsage, null, 2), 'utf-8')

  logger.info('📊 Mock agentic evaluation usage tracked')
  logger.info('✓ Mock agentic evaluation completed')

  return { verdict: mockVerdict, report: mockReport }
}

/**
 * Discover workspaces from environment variables
 */
function discoverWorkspaces() {
  logger.info('🔍 Checking for cloned workspaces...')
  logger.info(`   Environment variables:`)
  logger.info(`   - WORKSPACE_COUNT: ${process.env.WORKSPACE_COUNT || 'not set'}`)
  logger.info(`   - WORKSPACE_DIRS: ${process.env.WORKSPACE_DIRS ? `${process.env.WORKSPACE_DIRS.substring(0, 100)}...` : 'not set'}`)
  logger.info(`   - WORKSPACE_NAMES: ${process.env.WORKSPACE_NAMES || 'not set'}`)
  logger.info(`   - WORKSPACE_BRANCHES: ${process.env.WORKSPACE_BRANCHES || 'not set'}`)
  logger.info(`   - FILE_SPACES: ${process.env.FILE_SPACES ? 'set' : 'not set'}`)

  const workspaceCount = parseInt(process.env.WORKSPACE_COUNT || '0', 10)
  const workspaceDirs = process.env.WORKSPACE_DIRS?.split(' ') || []
  const workspaceNames = process.env.WORKSPACE_NAMES?.split(' ') || []
  const workspaceBranches = process.env.WORKSPACE_BRANCHES?.split(' ') || []

  if (workspaceCount === 0 || workspaceDirs.length === 0) {
    logger.error('❌ No workspaces found!')
    logger.error('   This usually means:')
    logger.error('   1. No FILE_SPACES environment variable was passed to the pipeline')
    logger.error('   2. The clone-workspace.sh script did not run')
    logger.error('   3. The clone-workspace.sh script failed')
    logger.error('')
    logger.error('   Please ensure:')
    logger.error('   - Task has file spaces configured')
    logger.error('   - FILE_SPACES variable is passed from pipeline-executor')
    logger.error('   - clone-workspace.sh script executed successfully in CI')
    throw new Error('No workspaces available for evaluation. Evaluation requires at least one workspace with code to analyze.')
  }

  logger.info(`📦 Found ${workspaceCount} cloned workspace(s)`)
  return { workspaceCount, workspaceDirs, workspaceNames, workspaceBranches }
}

/**
 * Validate workspace directories exist
 */
function validateWorkspaces(
  workspaceDirs: string[],
  workspaceNames: string[],
  workspaceBranches: string[],
  workspaceCount: number
): WorkspaceInfo[] {
  const validWorkspaces: WorkspaceInfo[] = []

  for (let i = 0; i < workspaceDirs.length; i++) {
    const dir = workspaceDirs[i]
    const name = workspaceNames[i] || `workspace-${i}`
    const branch = workspaceBranches[i] || 'unknown'

    if (!dir) {
      logger.warn(`   ⚠️  Workspace ${i} has no directory, skipping`)
      continue
    }

    logger.info(`   Checking workspace ${i + 1}/${workspaceCount}: ${name}`)
    logger.info(`     Directory: ${dir}`)
    logger.info(`     Branch: ${branch}`)

    if (existsSync(dir)) {
      validWorkspaces.push({ dir, name, branch })
      logger.info(`     ✓ Directory exists`)
    } else {
      logger.error(`     ❌ Directory not found: ${dir}`)
    }
  }

  if (validWorkspaces.length === 0) {
    logger.error('❌ No valid workspace directories found!')
    logger.error(`   Expected directories:`)
    workspaceDirs.forEach((dir, i) => {
      logger.error(`   - ${workspaceNames[i] || `workspace-${i}`}: ${dir}`)
    })
    throw new Error('All workspace directories are missing or inaccessible')
  }

  logger.info(`✓ ${validWorkspaces.length} valid workspace(s) ready for evaluation`)
  return validWorkspaces
}

/**
 * Build codebase info string for prompt
 */
function buildCodebaseInfo(validWorkspaces: WorkspaceInfo[]): string {
  if (validWorkspaces.length === 1) {
    const ws = validWorkspaces[0]!
    logger.info(`   Using single workspace: ${ws.name}`)
    return `Codebase cloned from repository (branch: ${ws.branch}) at: ${ws.dir}`
  }

  logger.info(`   Using multiple workspaces:`)
  validWorkspaces.forEach(ws => {
    logger.info(`     - ${ws.name} (${ws.branch}): ${ws.dir}`)
  })

  return `Multiple codebases available for analysis:\n${validWorkspaces.map(ws => `- ${ws.name} (branch: ${ws.branch}): ${ws.dir}`).join('\n')}`
}

/**
 * Build evaluation prompt for Claude
 */
function buildEvaluationPrompt(task: { title: string; description: string | null }, codebaseInfo: string): string {
  return `You MUST evaluate a task by exploring the codebase and creating two files.

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
}

/**
 * Prepare Claude environment with API key and proxy settings
 */
function prepareClaudeEnvironment(env: Record<string, string>) {
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  }

  const claudeEnv = { ...process.env }

  if (process.env.PROXY_HOST && process.env.PROXY_USER && process.env.PROXY_PASS) {
    const proxyUrl = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}`
    claudeEnv.HTTP_PROXY = proxyUrl
    claudeEnv.HTTPS_PROXY = proxyUrl
    logger.info(`✓ Configured standard proxy environment variables for Claude Code`)
  }

  return claudeEnv
}

/**
 * Get Claude Code executable path
 */
function getClaudePath(): string {
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  const claudePath = resolve(__dirname, 'node_modules/.bin/claude')
  logger.info(`Using Claude executable: ${claudePath}`)

  if (!existsSync(claudePath)) {
    logger.error(`❌ Claude executable not found at: ${claudePath}`)
    logger.info('Checking alternative locations...')
    const altPath = resolve(__dirname, '../node_modules/.bin/claude')
    logger.info(`Alternative path: ${altPath} - exists: ${existsSync(altPath)}`)
  } else {
    logger.info(`✓ Claude executable found at: ${claudePath}`)
  }

  return claudePath
}

/**
 * Determine working directory for Claude Code
 */
function determineWorkingDirectory(workspaceCount: number, workspaceDirs: string[]): string {
  logger.info('📂 Determining Claude Code working directory...')
  logger.info(`   Workspace count: ${workspaceCount}`)
  logger.info(`   Workspace dirs length: ${workspaceDirs.length}`)

  if (workspaceCount === 0 || workspaceDirs.length === 0) {
    logger.info(`   Strategy: Fallback (no workspaces)`)
    logger.info(`   Selected: ..`)
    return '..'
  }

  const firstDir = workspaceDirs[0]
  if (!firstDir) {
    logger.warn(`   ⚠️  First workspace directory is undefined, using fallback`)
    return '..'
  }

  if (workspaceCount === 1) {
    logger.info(`   Strategy: Single workspace`)
    logger.info(`   Selected: ${firstDir}`)
    return firstDir
  }

  const parentDir = firstDir.replace(/\/workspace-\d+$/, '')
  logger.info(`   Strategy: Multiple workspaces`)
  logger.info(`   First workspace: ${firstDir}`)
  logger.info(`   Extracted parent: ${parentDir}`)
  logger.info(`   Selected: ${parentDir}`)
  return parentDir
}

/**
 * Execute Claude Agent SDK and process results
 */
async function executeClaudeAgent(
  prompt: string,
  claudeEnv: NodeJS.ProcessEnv,
  claudePath: string,
  workingDir: string,
  agenticStart: number
): Promise<void> {
  if (!existsSync(workingDir)) {
    throw new Error(`Working directory not found: ${workingDir}`)
  }
  logger.info(`   ✓ Working directory exists`)

  logger.info('')
  logger.info(`📋 Claude Code query options:`)
  logger.info(`  - permissionMode: acceptEdits`)
  logger.info(`  - claudePath: ${claudePath}`)
  logger.info(`  - cwd: ${workingDir}`)
  logger.info(`  - allowedTools: Bash, Read, Glob, Grep, Write`)
  logger.info(`  - ANTHROPIC_API_KEY set: ${!!claudeEnv.ANTHROPIC_API_KEY}`)
  logger.info(`  - HTTP_PROXY set: ${!!claudeEnv.HTTP_PROXY}`)
  logger.info(`  - HTTPS_PROXY set: ${!!claudeEnv.HTTPS_PROXY}`)

  const iterator = query({
    prompt,
    options: {
      permissionMode: 'acceptEdits',
      systemPrompt: 'You are a code evaluation assistant. Your job is to explore codebases, analyze task feasibility, and create structured evaluation reports. Always use the Write tool to create files - never just describe what files should contain. Be thorough in your analysis and concrete in your recommendations.',
      env: claudeEnv,
      pathToClaudeCodeExecutable: claudePath,
      cwd: workingDir,
      allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write'],
      stderr: (data: string) => {
        logger.error(`[Claude Code stderr] ${data}`)
      },
    },
  })

  logger.info('✓ Query iterator created, starting iteration...')

  let iterations = 0
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
      logger.info(`[Assistant] ${JSON.stringify(chunk.message)}`)
    }

    if (chunk.type === 'stream_event') {
      logger.info(`[Stream] event=${JSON.stringify(chunk.event)}`)
    }

    if (chunk.type === 'result') {
      const cost = chunk.total_cost_usd || 0
      logger.info(`✓ Claude Agent completed - Cost: $${cost.toFixed(4)}, Iterations: ${iterations}`)

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

      await writeFile('../results/agentic-usage.json', JSON.stringify(agenticUsage, null, 2), 'utf-8')
      logger.info('📊 Agentic evaluation usage tracked')
    }
  }

  logger.info('✓ Claude Agent SDK execution completed')
}

/**
 * Read evaluation results from files created by agent
 */
async function readEvaluationResults(): Promise<EvaluationResult> {
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
}

/**
 * Advanced Agentic Evaluation - Generate agent instructions using Claude Code Agent SDK
 * Note: Simple evaluation is now handled by microservice before CI is triggered
 */
async function agenticEvaluation(
  task: { id: string; title: string; description: string | null },
  env: Record<string, string>
): Promise<EvaluationResult> {
  logger.info('🔬 Phase 2: Running deep agentic evaluation...')

  if (process.env.MOCK_MODE === 'true') {
    return await handleMockMode(task)
  }

  const { workspaceCount, workspaceDirs, workspaceNames, workspaceBranches } = discoverWorkspaces()
  const validWorkspaces = validateWorkspaces(workspaceDirs, workspaceNames, workspaceBranches, workspaceCount)
  const codebaseInfo = buildCodebaseInfo(validWorkspaces)
  const prompt = buildEvaluationPrompt(task, codebaseInfo)

  const claudeEnv = prepareClaudeEnvironment(env)
  const claudePath = getClaudePath()
  const workingDir = determineWorkingDirectory(workspaceCount, workspaceDirs)

  const agenticStart = Date.now()

  try {
    logger.info('🤖 Starting Claude Agent SDK for evaluation...')
    await executeClaudeAgent(prompt, claudeEnv, claudePath, workingDir, agenticStart)
    return await readEvaluationResults()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error(`❌ Claude Agent SDK error: ${errorMsg}`)
    if (errorStack) {
      logger.error(`Stack trace:\n${errorStack}`)
    }

    throw new Error(`Claude Agent SDK execution failed: ${errorMsg}`)
  }
}

async function main() {
  logger.info('🤖 Advanced Evaluation Pipeline Started')
  logger.info('ℹ️  Simple evaluation already completed in microservice - running advanced evaluation only')

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

    // Run advanced agentic evaluation (simple eval already done in microservice)
    logger.info('🔬 Running advanced agentic evaluation...')
    await agenticEvaluation(task, { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY })

    logger.info('✅ Advanced evaluation pipeline completed successfully')
  } catch (error) {
    logger.error('❌ Advanced evaluation pipeline failed:', error)

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

// Export for use in worker binary
export { main as evaluationPipeline }

// Run if called directly (not from worker binary)
if (!process.env.__WORKER_BINARY__) {
  const isMainModule = import.meta.url === `file://${process.argv[1]}`
  if (isMainModule) {
    main()
  }
}
