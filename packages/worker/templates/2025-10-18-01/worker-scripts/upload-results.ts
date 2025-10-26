#!/usr/bin/env bun
import { ApiClient } from './shared/api-client'
import { readFile } from 'fs/promises'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'
import { createLogger } from './shared/logger'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'upload-results' })

const apiClient = new ApiClient(
  process.env.API_BASE_URL!,
  process.env.API_TOKEN!
)

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists()
}

async function main() {
  const executionId = process.env.PIPELINE_EXECUTION_ID!
  const sessionId = process.env.SESSION_ID!

  logger.info('📤 Upload Results Started')
  logger.info(`Execution ID: ${executionId}`)

  try {
    // Read results from previous stage
    logger.info('📥 Reading results from execute stage...')
    const resultsText = await readFile('../results/output.json', 'utf-8')
    const results = JSON.parse(resultsText)

    logger.info('✓ Results loaded')

    // Upload implementation usage metrics
    if (await fileExists('../results/implementation-usage.json')) {
      try {
        const usageText = await readFile('../results/implementation-usage.json', 'utf-8')
        const usage = JSON.parse(usageText)
        await apiClient.saveApiUsage(executionId, sessionId, results.task.id, usage)
        logger.info('✓ Implementation usage metrics uploaded')
      } catch (usageError) {
        logger.error('Failed to upload implementation usage:', usageError)
      }
    }

    logger.info('📝 Creating pipeline artifacts...')

    // Create merge request in target repository if changes were made
    let mrUrl = null
    let branchName = null

    if (
      results.fileSpace &&
      results.fileSpace.config &&
      typeof results.fileSpace.config === 'object' &&
      'repo' in results.fileSpace.config &&
      results.agentResults.changes &&
      Object.keys(results.agentResults.changes).length > 0
    ) {
      const sessionId = process.env.SESSION_ID!
      const workspacePath = `/tmp/workspace-${sessionId}`
      branchName = `issue/task-${results.task.id.slice(0, 8)}`

      logger.info('📤 Creating merge request...')

      try {
        // Build MR description
        let mrDescription = `${results.task.description || 'Automated task'}\n\n`
        mrDescription += `## Agent Results\n\n`
        mrDescription += `**Status**: ${results.completionCheck.isComplete ? '✅ Complete' : '⚠️ Incomplete'}\n`
        mrDescription += `**Confidence**: ${results.completionCheck.confidence}\n\n`

        if (results.clarificationCheck.needsClarification) {
          mrDescription += `### Clarification Needed\n\n`
          mrDescription += `${results.clarificationCheck.reason}\n\n`

          if (results.clarificationCheck.questions && results.clarificationCheck.questions.length > 0) {
            mrDescription += `**Questions:**\n`
            for (const question of results.clarificationCheck.questions) {
              mrDescription += `- ${question}\n`
            }
            mrDescription += `\n`
          }
        }

        mrDescription += `---\n`
        mrDescription += `🤖 Automated by ADI Pipeline\n`
        mrDescription += `Session: ${sessionId}\n`

        // Create MR using glab CLI
        const { stdout } = await exec(
          `cd ${workspacePath} && glab mr create --title "${results.task.title.replace(/"/g, '\\"')}" --description "${mrDescription.replace(/"/g, '\\"')}" --fill --yes`,
          {
            env: {
              ...process.env,
              GITLAB_TOKEN: process.env.GITLAB_TOKEN,
            },
          }
        )

        // Parse MR URL from glab output
        const urlMatch = stdout.match(/https:\/\/[^\s]+\/merge_requests\/\d+/)
        if (urlMatch) {
          mrUrl = urlMatch[0]
          logger.info(`✓ Merge request created: ${mrUrl}`)
        } else {
          logger.warn('⚠️  MR created but could not parse URL from output')
          logger.info(stdout)
        }
      } catch (error) {
        logger.error('❌ Failed to create merge request:', error)
        logger.error(error instanceof Error ? error.message : String(error))

        // Continue even if MR creation fails - we'll create artifact without MR URL
      }
    } else {
      logger.warn('⚠️  No changes to create merge request for')
    }

    // Create artifact record
    if (mrUrl) {
      await apiClient.createPipelineArtifact(executionId, {
        artifact_type: 'merge_request',
        reference_url: mrUrl,
        metadata: {
          title: results.task.title,
          description: results.task.description,
          branch: branchName,
          completed: results.completionCheck.isComplete,
          needs_clarification: results.clarificationCheck.needsClarification,
        },
      })

      logger.info(`✓ Created artifact: merge_request → ${mrUrl}`)
    } else if (results.agentResults.exitCode === 0) {
      // Create artifact with execution results even without MR (use issue type as fallback)
      await apiClient.createPipelineArtifact(executionId, {
        artifact_type: 'issue',
        reference_url: '#',
        metadata: {
          title: results.task.title,
          completed: results.completionCheck.isComplete,
          needs_clarification: results.clarificationCheck.needsClarification,
          exit_code: results.agentResults.exitCode,
          has_changes: Boolean(results.agentResults.changes && Object.keys(results.agentResults.changes).length > 0),
        },
      })

      logger.info(`✓ Created artifact: execution result`)
    }

    // Update task status
    logger.info('📝 Updating task status...')
    const newStatus = results.completionCheck.isComplete
      ? 'completed'
      : 'needs_clarification'

    await apiClient.updateTaskStatus(results.task.id, newStatus)
    logger.info(`✓ Task status updated to: ${newStatus}`)

    logger.info('✅ Upload results completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Upload results failed:', error)
    process.exit(1)
  }
}

main()
