#!/usr/bin/env bun
/**
 * Claude Pipeline Runner
 * Executes Claude Code agent on tasks
 */

import { ApiClient } from './shared/api-client'
import { runTrafficCheck } from './shared/traffic-check'
import { runCompletionCheck } from './shared/completion-check'
import { runClarificationCheck } from './shared/clarification-check'
import { mkdir } from 'fs/promises'
import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'
import { createLogger } from './shared/logger'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'claude-pipeline' })

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = [
    'SESSION_ID',
    'PIPELINE_EXECUTION_ID',
    'API_BASE_URL',
    'API_TOKEN',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }

  logger.info('✓ Environment variables validated')
}

async function main() {
  logger.info('🤖 Claude Pipeline Started')

  try {
    // Validate environment
    validateEnvironment()

    const sessionId = process.env.SESSION_ID!
    const executionId = process.env.PIPELINE_EXECUTION_ID!

    logger.info(`Session ID: ${sessionId}`)
    logger.info(`Execution ID: ${executionId}`)

    const apiClient = new ApiClient(
      process.env.API_BASE_URL!,
      process.env.API_TOKEN!
    )
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

    // Run traffic check
    logger.info('🚦 Running traffic check...')
    const trafficCheck = await runTrafficCheck(task)
    if (!trafficCheck.shouldProcess) {
      logger.warn(`⚠️  Traffic check failed: ${trafficCheck.reason}`)
      process.exit(0) // Exit successfully but skip processing
    }
    logger.info('✓ Traffic check passed')

    // Fetch file space if available
    let fileSpace = null
    if (task.file_space_id) {
      logger.info('📥 Fetching file space from API...')
      fileSpace = await apiClient.getFileSpace(task.file_space_id)
      logger.info(`✓ File space loaded: ${fileSpace.name} (${fileSpace.type})`)

      // Validate file space configuration
      if (fileSpace.config && typeof fileSpace.config === 'object' && 'repo' in fileSpace.config) {
        const repoUrl = (fileSpace.config as { repo: string }).repo
        if (!repoUrl || typeof repoUrl !== 'string') {
          throw new Error(`Invalid file space configuration: 'repo' must be a non-empty string`)
        }
        logger.info(`✓ File space configuration validated`)
      }
    } else {
      logger.info('ℹ️  No file space configured for this task')
    }

    // Validate ANTHROPIC_API_KEY before proceeding
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is required. Please configure it in GitLab CI/CD variables.'
      )
    }

    // Create results directory
    await mkdir('../results', { recursive: true })

    logger.info('🔧 Running Claude Code agent...')
    logger.info(`Task: ${task.title}`)
    logger.info(`Description: ${task.description || 'N/A'}`)

    // Initialize agent results
    const agentResults = {
      exitCode: 0,
      output: '',
      changes: {},
      errors: [] as string[],
    }

    // Clone or pull repository if file space is provided
    if (fileSpace && fileSpace.config && typeof fileSpace.config === 'object' && 'repo' in fileSpace.config) {
      const repoUrl = (fileSpace.config as { repo: string }).repo
      const branchName = `issue/task-${task.id.slice(0, 8)}`

      // Use workspaces directory in the worker repository instead of /tmp
      const workspaceName = fileSpace.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
      const workspacePath = `../workspaces/${workspaceName}`

      logger.info(`📦 Setting up repository: ${repoUrl}`)
      try {
        // Validate repo URL format
        if (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://') && !repoUrl.startsWith('git@')) {
          throw new Error(
            `Invalid repository URL format: ${repoUrl}. Must start with http://, https://, or git@`
          )
        }

        // Create workspaces directory if it doesn't exist
        await mkdir('../workspaces', { recursive: true })

        // Check if repository already exists
        try {
          await exec(`test -d ${workspacePath}/.git`)
          logger.info(`✓ Repository already exists at ${workspacePath}`)

          // Repository exists, pull latest changes
          logger.info(`🔄 Pulling latest changes...`)
          await exec(`cd ${workspacePath} && git fetch --all`)
          await exec(`cd ${workspacePath} && git pull origin HEAD`)
          logger.info(`✓ Repository updated`)
        } catch {
          // Repository doesn't exist, clone it
          logger.info(`📦 Cloning repository: ${repoUrl}`)
          await exec(`git clone ${repoUrl} ${workspacePath}`)
          logger.info(`✓ Repository cloned to ${workspacePath}`)
        }

        // Create and checkout branch
        logger.info(`🌿 Creating branch: ${branchName}`)
        await exec(`cd ${workspacePath} && git checkout -b ${branchName}`)
        logger.info(`✓ Branch created and checked out`)

        // Execute Claude Code CLI
        logger.info('🤖 Executing Claude Code...')
        const prompt = `${task.title}\n\n${task.description || ''}`

        // Run Claude Code CLI (assuming it's installed globally or in PATH)
        // Using spawn to capture real-time output
        const claudeProcess = spawn(
          'claude',
          [prompt],
          {
            cwd: workspacePath,
            env: {
              ...process.env,
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            },
          }
        )

        // Capture output
        let stdout = ''
        let stderr = ''

        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString()
          stdout += chunk
          logger.info(chunk)
        })

        claudeProcess.stderr.on('data', (data) => {
          const chunk = data.toString()
          stderr += chunk
          logger.error(chunk)
        })

        // Wait for completion
        await new Promise<void>((resolve, reject) => {
          claudeProcess.on('close', (code) => {
            agentResults.exitCode = code || 0
            agentResults.output = stdout

            if (stderr) {
              agentResults.errors.push(stderr)
            }

            if (code === 0) {
              logger.info('✓ Claude Code execution completed')
              resolve()
            } else {
              logger.error(`❌ Claude Code exited with code ${code}`)
              reject(new Error(`Claude Code exited with code ${code}`))
            }
          })

          claudeProcess.on('error', (error) => {
            agentResults.errors.push(error.message)
            reject(error)
          })
        })

        // Check for changes
        logger.info('📊 Checking for changes...')
        const { stdout: statusOutput } = await exec(`cd ${workspacePath} && git status --porcelain`)

        if (statusOutput.trim()) {
          logger.info('✓ Changes detected')
          agentResults.changes = { modified: statusOutput.trim().split('\n') }

          // Commit changes
          logger.info('💾 Committing changes...')
          await exec(`cd ${workspacePath} && git add .`)
          await exec(
            `cd ${workspacePath} && git commit -m "🤖 ${task.title}\n\nAutomated by ADI Claude Pipeline\nSession: ${sessionId}"`
          )
          logger.info('✓ Changes committed')

          // Push to remote
          logger.info('📤 Pushing to remote...')
          await exec(`cd ${workspacePath} && git push origin ${branchName}`)
          logger.info('✓ Changes pushed to remote')
        } else {
          logger.warn('⚠️  No changes detected')
        }
      } catch (error) {
        logger.error('❌ Repository operations failed:', error)
        agentResults.errors.push(error instanceof Error ? error.message : String(error))
        agentResults.exitCode = 1
        throw error
      }
    } else {
      logger.warn('⚠️  No file space configured - running without repository context')

      // Run Claude Code without repository (for general tasks)
      logger.info('🤖 Executing Claude Code...')
      const prompt = `${task.title}\n\n${task.description || ''}`

      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable not set')
      }

      const claudeProcess = spawn(
        'claude',
        [prompt],
        {
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          },
        }
      )

      let stdout = ''
      let stderr = ''

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString()
        stdout += chunk
        logger.info(chunk)
      })

      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString()
        stderr += chunk
        logger.error(chunk)
      })

      await new Promise<void>((resolve, reject) => {
        claudeProcess.on('close', (code) => {
          agentResults.exitCode = code || 0
          agentResults.output = stdout

          if (stderr) {
            agentResults.errors.push(stderr)
          }

          if (code === 0) {
            logger.info('✓ Claude Code execution completed')
            resolve()
          } else {
            logger.error(`❌ Claude Code exited with code ${code}`)
            reject(new Error(`Claude Code exited with code ${code}`))
          }
        })

        claudeProcess.on('error', (error) => {
          agentResults.errors.push(error.message)
          reject(error)
        })
      })
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
          fileSpace,
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
