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

      // TODO: Add proper admin authorization check here
      // For now, any authenticated user can refresh repos
      // In production, check if user has admin role

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
          { remote: `${templateVersion}/.gitlab-ci-evaluation.yml`, local: '.gitlab-ci-evaluation.yml' },
          { remote: `${templateVersion}/.gitlab-ci-claude.yml`, local: '.gitlab-ci-claude.yml' },
          { remote: `${templateVersion}/.gitlab-ci-codex.yml`, local: '.gitlab-ci-codex.yml' },
          { remote: `${templateVersion}/.gitlab-ci-gemini.yml`, local: '.gitlab-ci-gemini.yml' },
          { remote: `${templateVersion}/worker-scripts/upload-evaluation-results.ts`, local: 'worker-scripts/upload-evaluation-results.ts' },
          { remote: `${templateVersion}/worker-scripts/upload-results.ts`, local: 'worker-scripts/upload-results.ts' },
          { remote: `${templateVersion}/worker-scripts/shared/api-client.ts`, local: 'worker-scripts/shared/api-client.ts' },
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

            let uploadedCount = 0
            const fileErrors: Array<{ file: string; error: string }> = []

            for (const file of filesToUpdate) {
              try {
                const filePath = join(templateDir, file.local)
                logger.info(`[Admin] Reading file: ${filePath}`)
                const content = await readFile(filePath, 'utf-8')

                logger.info(`[Admin] Uploading to ${file.remote} in project ${repo.source_gitlab.project_id}`)
                await client.uploadFile(
                  repo.source_gitlab.project_id,
                  file.remote,
                  content,
                  `🔄 Admin refresh: ${file.remote}`,
                  'main'
                )

                uploadedCount++
                logger.info(`[Admin] ✓ Uploaded ${file.remote}`)
              } catch (fileError) {
                const errorMsg = fileError instanceof Error ? fileError.message : String(fileError)
                logger.warn(`[Admin] Failed to update ${file.remote} for ${repo.project_name}:`, errorMsg)
                fileErrors.push({ file: file.remote, error: errorMsg })
                // Continue with other files even if one fails
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
