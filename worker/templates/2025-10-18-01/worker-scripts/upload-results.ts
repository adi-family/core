#!/usr/bin/env bun
/**
 * Upload Results Script
 * Uploads pipeline artifacts to our API
 */

import { ApiClient } from './shared/api-client'
import { readFile } from 'fs/promises'
import { promisify } from 'util'
import { exec as execCallback } from 'child_process'

const exec = promisify(execCallback)

const apiClient = new ApiClient(
  process.env.API_BASE_URL!,
  process.env.API_TOKEN!
)

async function main() {
  const executionId = process.env.PIPELINE_EXECUTION_ID!

  console.log('📤 Upload Results Started')
  console.log(`Execution ID: ${executionId}`)

  try {
    // Read results from previous stage
    console.log('📥 Reading results from execute stage...')
    const resultsText = await readFile('../results/output.json', 'utf-8')
    const results = JSON.parse(resultsText)

    console.log('✓ Results loaded')

    console.log('📝 Creating pipeline artifacts...')

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

      console.log('📤 Creating merge request...')

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
          console.log(`✓ Merge request created: ${mrUrl}`)
        } else {
          console.log('⚠️  MR created but could not parse URL from output')
          console.log(stdout)
        }
      } catch (error) {
        console.error('❌ Failed to create merge request:', error)
        console.error(error instanceof Error ? error.message : String(error))

        // Continue even if MR creation fails - we'll create artifact without MR URL
      }
    } else {
      console.log('⚠️  No changes to create merge request for')
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

      console.log(`✓ Created artifact: merge_request → ${mrUrl}`)
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
          has_changes: !!(results.agentResults.changes && Object.keys(results.agentResults.changes).length > 0),
        },
      })

      console.log(`✓ Created artifact: execution result`)
    }

    // Update task status
    console.log('📝 Updating task status...')
    const newStatus = results.completionCheck.isComplete
      ? 'completed'
      : 'needs_clarification'

    await apiClient.updateTaskStatus(results.task.id, newStatus)
    console.log(`✓ Task status updated to: ${newStatus}`)

    console.log('✅ Upload results completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Upload results failed:', error)
    process.exit(1)
  }
}

main()
