#!/usr/bin/env bun
import { ApiClient } from './shared/api-client'
import { readFile } from 'fs/promises'
import { createLogger } from './shared/logger'

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

    // Push was already done in execute stage - read the result from output.json
    const pushResult = results.pushResult

    // Create artifact records for each merge request
    if (pushResult && pushResult.mergeRequests && pushResult.mergeRequests.length > 0) {
      for (const mr of pushResult.mergeRequests) {
        await apiClient.createPipelineArtifact(executionId, {
          artifact_type: 'merge_request',
          reference_url: mr.mrUrl,
          metadata: {
            title: results.task.title,
            description: results.task.description,
            branch: mr.branchName,
            file_space_id: mr.fileSpaceId,
            file_space_name: mr.fileSpaceName,
            mr_iid: mr.mrIid,
            completed: results.completionCheck.isComplete,
            needs_clarification: results.clarificationCheck.needsClarification,
          },
        })

        logger.info(`✓ Created artifact: merge_request → ${mr.mrUrl}`)
      }
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
          push_errors: pushResult?.errors || [],
        },
      })

      logger.info(`✓ Created artifact: execution result`)
    } else {
      logger.info('ℹ️  No artifacts created (agent execution failed)')
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
