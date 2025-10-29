/**
 * Workspace Sync Service
 * Triggers GitLab CI pipeline to sync file space repositories as git submodules
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { extractGitLabCredentials, type GitLabSource } from '../worker-orchestration/gitlab-utils'
import type { WorkerRepository } from '@types'
import { updateProjectLastSyncedAt } from '../../db/projects'

const logger = createLogger({ namespace: 'workspace-sync' })

export interface TriggerWorkspaceSyncInput {
  projectId: string
}

export interface TriggerWorkspaceSyncResult {
  success: boolean
  pipelineId?: number
  pipelineUrl?: string
  error?: string
}

/**
 * Trigger workspace sync pipeline for a project
 * This syncs file spaces (workspace repositories) as git submodules
 */
export async function triggerWorkspaceSync(
  sql: Sql,
  input: TriggerWorkspaceSyncInput
): Promise<TriggerWorkspaceSyncResult> {
  const { projectId } = input

  try {
    logger.info(`🔄 Triggering workspace sync for project ${projectId}`)

    // Get worker repository for the project
    const workerRepos = await sql<WorkerRepository[]>`
      SELECT * FROM worker_repositories
      WHERE project_id = ${projectId}
      LIMIT 1
    `

    if (workerRepos.length === 0) {
      const error = 'No worker repository found for project'
      logger.warn(`⚠️  ${error}: ${projectId}`)
      return { success: false, error }
    }

    const repo = workerRepos[0]

    if (!repo || !repo.source_gitlab) {
      const error = 'Worker repository is not GitLab-based'
      logger.warn(`⚠️  ${error}`)
      return { success: false, error }
    }

    // Extract and validate GitLab credentials
    const { host, projectId: gitlabProjectId, accessToken } = extractGitLabCredentials(repo.source_gitlab as GitLabSource)

    // Create GitLab client
    const client = new GitLabApiClient(host, accessToken)

    // Verify project exists and enable CI/CD
    try {
      logger.info(`Verifying GitLab project ${gitlabProjectId} and enabling CI/CD`)
      await client.getProject(gitlabProjectId)
      await client.enableCICD(gitlabProjectId)
      await client.enableExternalPipelineVariables(gitlabProjectId)
      logger.info(`✓ CI/CD enabled for project ${gitlabProjectId}`)
    } catch (setupError) {
      const errorMsg = setupError instanceof Error ? setupError.message : String(setupError)
      logger.error(`Failed to setup CI/CD: ${errorMsg}`)
      throw new Error(`CI/CD setup failed: ${errorMsg}`)
    }

    // Prepare pipeline variables
    const apiBaseUrl = process.env.API_BASE_URL || process.env.GITLAB_RUNNER_API_URL || 'http://localhost:5174'
    const apiToken = process.env.API_TOKEN || process.env.BACKEND_API_TOKEN || ''
    const gitlabToken = process.env.GITLAB_TOKEN || ''

    if (!apiToken) {
      const error = 'API_TOKEN not configured - cannot trigger pipeline'
      logger.error(`❌ ${error}`)
      return { success: false, error }
    }

    const pipelineVariables: Record<string, string> = {
      PROJECT_ID: projectId,
      API_BASE_URL: apiBaseUrl,
      API_TOKEN: apiToken,
      WORKER_REPO_TOKEN: accessToken,
      SYNC_ONLY: 'true', // Trigger workspace sync job
    }

    // Add GITLAB_TOKEN if available (for cloning private workspace repos)
    if (gitlabToken) {
      pipelineVariables.GITLAB_TOKEN = gitlabToken
    }

    // Trigger pipeline with workspace-sync configuration
    logger.info(`Triggering workspace sync pipeline on ${gitlabProjectId}`)
    const pipeline = await client.triggerPipeline(
      gitlabProjectId,
      {
        ref: 'main',
        variables: pipelineVariables
      }
    )

    logger.info(`✅ Workspace sync pipeline #${pipeline.id} triggered: ${pipeline.web_url}`)

    // Update project's last synced timestamp
    const updateResult = await updateProjectLastSyncedAt(sql, projectId)
    if (!updateResult.ok) {
      logger.warn(`⚠️  Failed to update last_synced_at for project ${projectId}: ${updateResult.error}`)
    } else {
      logger.info(`✓ Updated last_synced_at for project ${projectId}`)
    }

    return {
      success: true,
      pipelineId: pipeline.id,
      pipelineUrl: pipeline.web_url
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Failed to trigger workspace sync for project ${projectId}:`, errorMsg)
    return {
      success: false,
      error: errorMsg
    }
  }
}
