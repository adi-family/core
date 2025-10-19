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

const exec = promisify(execCallback)

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

  console.log('✓ Environment variables validated')
}

async function main() {
  console.log('🤖 Claude Pipeline Started')

  try {
    // Validate environment
    validateEnvironment()

    const sessionId = process.env.SESSION_ID!
    const executionId = process.env.PIPELINE_EXECUTION_ID!

    console.log(`Session ID: ${sessionId}`)
    console.log(`Execution ID: ${executionId}`)

    const apiClient = new ApiClient(
      process.env.API_BASE_URL!,
      process.env.API_TOKEN!
    )
    // Fetch session and task via API
    console.log('📥 Fetching session from API...')
    const session = await apiClient.getSession(sessionId)
    console.log(`✓ Session loaded: runner=${session.runner}`)

    if (!session.task_id) {
      throw new Error('Session has no associated task')
    }

    console.log('📥 Fetching task from API...')
    const task = await apiClient.getTask(session.task_id)
    console.log(`✓ Task loaded: ${task.title}`)

    // Run traffic check
    console.log('🚦 Running traffic check...')
    const trafficCheck = await runTrafficCheck(task)
    if (!trafficCheck.shouldProcess) {
      console.log(`⚠️  Traffic check failed: ${trafficCheck.reason}`)
      process.exit(0) // Exit successfully but skip processing
    }
    console.log('✓ Traffic check passed')

    // Fetch file space if available
    let fileSpace = null
    if (task.file_space_id) {
      console.log('📥 Fetching file space from API...')
      fileSpace = await apiClient.getFileSpace(task.file_space_id)
      console.log(`✓ File space loaded: ${fileSpace.name} (${fileSpace.type})`)

      // Validate file space configuration
      if (fileSpace.config && typeof fileSpace.config === 'object' && 'repo' in fileSpace.config) {
        const repoUrl = (fileSpace.config as { repo: string }).repo
        if (!repoUrl || typeof repoUrl !== 'string') {
          throw new Error(`Invalid file space configuration: 'repo' must be a non-empty string`)
        }
        console.log(`✓ File space configuration validated`)
      }
    } else {
      console.log('ℹ️  No file space configured for this task')
    }

    // Validate ANTHROPIC_API_KEY before proceeding
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is required. Please configure it in GitLab CI/CD variables.'
      )
    }

    // Create results directory
    await mkdir('../results', { recursive: true })

    console.log('🔧 Running Claude Code agent...')
    console.log(`Task: ${task.title}`)
    console.log(`Description: ${task.description || 'N/A'}`)

    // Initialize agent results
    const agentResults = {
      exitCode: 0,
      output: '',
      changes: {},
      errors: [] as string[],
    }

    // Clone repository if file space is provided
    if (fileSpace && fileSpace.config && typeof fileSpace.config === 'object' && 'repo' in fileSpace.config) {
      const repoUrl = (fileSpace.config as { repo: string }).repo
      const branchName = `issue/task-${task.id.slice(0, 8)}`
      const workspacePath = `/tmp/workspace-${sessionId}`

      console.log(`📦 Cloning repository: ${repoUrl}`)
      try {
        // Validate repo URL format
        if (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://') && !repoUrl.startsWith('git@')) {
          throw new Error(
            `Invalid repository URL format: ${repoUrl}. Must start with http://, https://, or git@`
          )
        }

        await exec(`git clone ${repoUrl} ${workspacePath}`)
        console.log(`✓ Repository cloned to ${workspacePath}`)

        // Create and checkout branch
        console.log(`🌿 Creating branch: ${branchName}`)
        await exec(`cd ${workspacePath} && git checkout -b ${branchName}`)
        console.log(`✓ Branch created and checked out`)

        // Execute Claude Code CLI
        console.log('🤖 Executing Claude Code...')
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
          console.log(chunk)
        })

        claudeProcess.stderr.on('data', (data) => {
          const chunk = data.toString()
          stderr += chunk
          console.error(chunk)
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
              console.log('✓ Claude Code execution completed')
              resolve()
            } else {
              console.error(`❌ Claude Code exited with code ${code}`)
              reject(new Error(`Claude Code exited with code ${code}`))
            }
          })

          claudeProcess.on('error', (error) => {
            agentResults.errors.push(error.message)
            reject(error)
          })
        })

        // Check for changes
        console.log('📊 Checking for changes...')
        const { stdout: statusOutput } = await exec(`cd ${workspacePath} && git status --porcelain`)

        if (statusOutput.trim()) {
          console.log('✓ Changes detected')
          agentResults.changes = { modified: statusOutput.trim().split('\n') }

          // Commit changes
          console.log('💾 Committing changes...')
          await exec(`cd ${workspacePath} && git add .`)
          await exec(
            `cd ${workspacePath} && git commit -m "🤖 ${task.title}\n\nAutomated by ADI Claude Pipeline\nSession: ${sessionId}"`
          )
          console.log('✓ Changes committed')

          // Push to remote
          console.log('📤 Pushing to remote...')
          await exec(`cd ${workspacePath} && git push origin ${branchName}`)
          console.log('✓ Changes pushed to remote')
        } else {
          console.log('⚠️  No changes detected')
        }
      } catch (error) {
        console.error('❌ Repository operations failed:', error)
        agentResults.errors.push(error instanceof Error ? error.message : String(error))
        agentResults.exitCode = 1
        throw error
      }
    } else {
      console.log('⚠️  No file space configured - running without repository context')

      // Run Claude Code without repository (for general tasks)
      console.log('🤖 Executing Claude Code...')
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
        console.log(chunk)
      })

      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString()
        stderr += chunk
        console.error(chunk)
      })

      await new Promise<void>((resolve, reject) => {
        claudeProcess.on('close', (code) => {
          agentResults.exitCode = code || 0
          agentResults.output = stdout

          if (stderr) {
            agentResults.errors.push(stderr)
          }

          if (code === 0) {
            console.log('✓ Claude Code execution completed')
            resolve()
          } else {
            console.error(`❌ Claude Code exited with code ${code}`)
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
    console.log('✅ Running completion check...')
    const completionCheck = await runCompletionCheck(agentResults)
    if (!completionCheck.isComplete) {
      console.log(
        `⚠️  Completion check failed: ${completionCheck.reason} (confidence: ${completionCheck.confidence})`
      )
    } else {
      console.log(
        `✓ Completion check passed (confidence: ${completionCheck.confidence})`
      )
    }

    // Run clarification check
    console.log('❓ Running clarification check...')
    const clarificationCheck = await runClarificationCheck(agentResults)
    if (clarificationCheck.needsClarification) {
      console.log(
        `⚠️  Clarification needed: ${clarificationCheck.reason}`
      )
      if (clarificationCheck.questions) {
        for (const question of clarificationCheck.questions) {
          console.log(`  - ${question}`)
        }
      }
    } else {
      console.log('✓ No clarification needed')
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

    console.log('✅ Claude pipeline completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Claude pipeline failed:', error)
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
