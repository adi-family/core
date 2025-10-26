/**
 * Admin Operations Handler
 * Provides administrative endpoints for system management
 */

import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { decrypt } from '@shared/crypto-utils'
import { createLogger } from '@utils/logger'
import { getClerkUserId } from '../middleware/clerk'

const logger = createLogger({ namespace: 'admin' })

interface WorkerRepo {
  id: string
  project_id: string
  project_name: string
  source_gitlab: {
    host: string
    project_id: string
    project_path: string
    access_token_encrypted: string
  }
  current_version: string
}

export const createAdminRoutes = (sql: Sql) => {
  return new Hono()
    /**
     * Refresh all worker repositories with latest CI templates
     * POST /admin/refresh-worker-repos
     */
    .post('/refresh-worker-repos', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      // Check if user has admin privileges
      // For now, we check if user has 'owner' or 'admin' role on any project
      // In a more sophisticated setup, you might have a separate admin_users table
      const hasAdminAccess = await sql<[{ has_admin: boolean }]>`
        SELECT EXISTS(
          SELECT 1 FROM user_access
          WHERE user_id = ${userId}
          AND entity_type = 'project'
          AND role IN ('owner', 'admin')
          AND (expires_at IS NULL OR expires_at > NOW())
        ) as has_admin
      `.then(rows => rows[0]?.has_admin ?? false)

      if (!hasAdminAccess) {
        logger.warn(`[Admin] Unauthorized access attempt by user: ${userId}`)
        return c.json({ error: 'Admin privileges required' }, 403)
      }

      logger.info(`[Admin] Worker repository refresh triggered by user: ${userId}`)

      try {
        // Get all worker repositories with project names
        const repos = await sql<WorkerRepo[]>`
          SELECT
            wr.id,
            wr.project_id,
            wr.source_gitlab,
            wr.current_version,
            p.name as project_name
          FROM worker_repositories wr
          JOIN projects p ON p.id = wr.project_id
          ORDER BY p.name
        `

        if (repos.length === 0) {
          logger.warn('[Admin] No worker repositories found')
          return c.json({
            success: true,
            message: 'No worker repositories to refresh',
            results: []
          })
        }

        logger.info(`[Admin] Found ${repos.length} worker repositories to refresh`)

        // Files to update (from current template version)
        const templateVersion = '2025-10-18-01' // TODO: Make this configurable
        const filesToUpdate = [
          { remote: '.gitlab-ci.yml', local: '.gitlab-ci.yml' },
          { remote: `${templateVersion}/.gitignore`, local: '.gitignore' },
          { remote: `${templateVersion}/.gitlab-ci-evaluation.yml`, local: '.gitlab-ci-evaluation.yml' },
          { remote: `${templateVersion}/.gitlab-ci-claude.yml`, local: '.gitlab-ci-claude.yml' },
          { remote: `${templateVersion}/.gitlab-ci-codex.yml`, local: '.gitlab-ci-codex.yml' },
          { remote: `${templateVersion}/.gitlab-ci-gemini.yml`, local: '.gitlab-ci-gemini.yml' },
          { remote: `${templateVersion}/worker-scripts/package.json`, local: 'worker-scripts/package.json' },
          { remote: `${templateVersion}/worker-scripts/sync-workspaces.ts`, local: 'worker-scripts/sync-workspaces.ts' },
          { remote: `${templateVersion}/worker-scripts/claude-pipeline.ts`, local: 'worker-scripts/claude-pipeline.ts' },
          { remote: `${templateVersion}/worker-scripts/codex-pipeline.ts`, local: 'worker-scripts/codex-pipeline.ts' },
          { remote: `${templateVersion}/worker-scripts/gemini-pipeline.ts`, local: 'worker-scripts/gemini-pipeline.ts' },
          { remote: `${templateVersion}/worker-scripts/evaluation-pipeline.ts`, local: 'worker-scripts/evaluation-pipeline.ts' },
          { remote: `${templateVersion}/worker-scripts/upload-evaluation-results.ts`, local: 'worker-scripts/upload-evaluation-results.ts' },
          { remote: `${templateVersion}/worker-scripts/upload-results.ts`, local: 'worker-scripts/upload-results.ts' },
          { remote: `${templateVersion}/worker-scripts/shared/api-client.ts`, local: 'worker-scripts/shared/api-client.ts' },
          { remote: `${templateVersion}/worker-scripts/shared/logger.ts`, local: 'worker-scripts/shared/logger.ts' },
          { remote: `${templateVersion}/worker-scripts/shared/traffic-check.ts`, local: 'worker-scripts/shared/traffic-check.ts' },
          { remote: `${templateVersion}/worker-scripts/shared/completion-check.ts`, local: 'worker-scripts/shared/completion-check.ts' },
          { remote: `${templateVersion}/worker-scripts/shared/clarification-check.ts`, local: 'worker-scripts/shared/clarification-check.ts' },
          { remote: `${templateVersion}/README.md`, local: 'README.md' },
        ]

        const results: Array<{
          project: string
          success: boolean
          error?: string
          filesUpdated?: number
        }> = []

        // Update each repository
        for (const repo of repos) {
          try {
            logger.info(`[Admin] Refreshing: ${repo.project_name}`)

            // Decrypt access token
            const accessToken = decrypt(repo.source_gitlab.access_token_encrypted)

            // Create GitLab client
            const client = new GitLabApiClient(repo.source_gitlab.host, accessToken)

            // Read and upload each file
            const { readFile } = await import('fs/promises')
            const { join, resolve } = await import('path')

            // Get project root (go up from packages/backend to project root)
            const projectRoot = resolve(process.cwd(), '../..')
            const templateDir = join(projectRoot, 'packages/worker/templates', templateVersion)

            // Prepare all files for batch upload
            const filesToUploadBatch: Array<{ path: string; content: string }> = []
            const fileErrors: Array<{ file: string; error: string }> = []

            for (const file of filesToUpdate) {
              try {
                const filePath = join(templateDir, file.local)
                logger.info(`[Admin] Reading file: ${filePath}`)
                const content = await readFile(filePath, 'utf-8')

                filesToUploadBatch.push({
                  path: file.remote,
                  content,
                })

                logger.info(`[Admin] 📄 Prepared ${file.remote}`)
              } catch (fileError) {
                const errorMsg = fileError instanceof Error ? fileError.message : String(fileError)
                logger.warn(`[Admin] Failed to read ${file.remote} for ${repo.project_name}:`, errorMsg)
                fileErrors.push({ file: file.remote, error: errorMsg })
                // Continue with other files even if one fails
              }
            }

            // Upload all files in a single batch commit
            let uploadedCount = 0
            if (filesToUploadBatch.length > 0) {
              try {
                const commitMessage = `🔄 Admin refresh: Update ${filesToUploadBatch.length} files`
                logger.info(`[Admin] Uploading ${filesToUploadBatch.length} files in batch to ${repo.source_gitlab.project_id}`)
                await client.uploadFiles(
                  repo.source_gitlab.project_id,
                  filesToUploadBatch,
                  commitMessage,
                  'main'
                )
                uploadedCount = filesToUploadBatch.length
                logger.info(`[Admin] ✓ Batch uploaded ${uploadedCount} files in a single commit`)

                // Trigger a pipeline to sync git submodules
                try {
                  logger.info(`[Admin] Triggering pipeline to sync submodules for ${repo.project_name}`)

                  // Get API credentials for the pipeline (same pattern as pipeline-executor.ts)
                  const apiBaseUrl = process.env.API_BASE_URL || process.env.GITLAB_RUNNER_API_URL || 'http://localhost:5174'
                  const apiToken = process.env.API_TOKEN || process.env.BACKEND_API_TOKEN || ''
                  const gitlabToken = process.env.GITLAB_TOKEN || ''

                  if (!apiToken) {
                    logger.warn(`[Admin] API_TOKEN not set, skipping submodule sync for ${repo.project_name}`)
                  } else {
                    const pipelineVariables: Record<string, string> = {
                      PROJECT_ID: repo.project_id,
                      API_BASE_URL: apiBaseUrl,
                      API_TOKEN: apiToken,
                      SYNC_ONLY: 'true', // Flag to indicate we only want to sync submodules
                    }

                    // Add GITLAB_TOKEN if available (for cloning private repos)
                    if (gitlabToken) {
                      pipelineVariables.GITLAB_TOKEN = gitlabToken
                    }

                    // Add WORKER_REPO_TOKEN - the access token for this specific worker repository
                    // This token has write permissions to push changes back to the worker repo
                    pipelineVariables.WORKER_REPO_TOKEN = accessToken

                    await client.triggerPipeline(
                      repo.source_gitlab.project_id,
                      {
                        ref: 'main',
                        variables: pipelineVariables
                      }
                    )
                    logger.info(`[Admin] ✓ Pipeline triggered for submodule sync`)
                  }
                } catch (pipelineError) {
                  const errorMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError)
                  logger.warn(`[Admin] Failed to trigger pipeline for ${repo.project_name}:`, errorMsg)
                  // Don't add to fileErrors as this is not critical - submodules will sync on next regular pipeline run
                }
              } catch (uploadError) {
                const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError)
                logger.error(`[Admin] Failed to batch upload files for ${repo.project_name}:`, errorMsg)
                fileErrors.push({ file: 'batch upload', error: errorMsg })
              }
            }

            results.push({
              project: repo.project_name,
              success: true,
              filesUpdated: uploadedCount,
              ...(fileErrors.length > 0 && { fileErrors })
            } as any)

            logger.info(`[Admin] ✓ Refreshed ${repo.project_name} (${uploadedCount} files, ${fileErrors.length} errors)`)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error(`[Admin] Failed to refresh ${repo.project_name}:`, errorMessage)

            results.push({
              project: repo.project_name,
              success: false,
              error: errorMessage
            })
          }
        }

        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length

        logger.info(`[Admin] Refresh complete: ${successCount} succeeded, ${failCount} failed`)

        return c.json({
          success: true,
          message: `Refreshed ${successCount} of ${repos.length} worker repositories`,
          results,
          summary: {
            total: repos.length,
            succeeded: successCount,
            failed: failCount
          }
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('[Admin] Worker repository refresh failed:', errorMessage)

        return c.json({
          error: 'Failed to refresh worker repositories',
          details: errorMessage
        }, 500)
      }
    })

    /**
     * Get worker repository status
     * GET /admin/worker-repos
     */
    .get('/worker-repos', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      try {
        const repos = await sql`
          SELECT
            wr.id,
            wr.project_id,
            wr.current_version,
            wr.source_gitlab->>'project_path' as gitlab_path,
            wr.source_gitlab->>'host' as gitlab_host,
            wr.updated_at,
            p.name as project_name
          FROM worker_repositories wr
          JOIN projects p ON p.id = wr.project_id
          ORDER BY p.name
        `

        return c.json({ repositories: repos })
      } catch (error) {
        logger.error('[Admin] Failed to fetch worker repositories:', error)
        return c.json({ error: 'Failed to fetch worker repositories' }, 500)
      }
    })
}
