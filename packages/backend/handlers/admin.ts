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

        // Discover all files to update from template directory
        const templateVersion = '2025-10-18-01' // TODO: Make this configurable
        const { readdir, readFile } = await import('fs/promises')
        const { join, resolve, relative } = await import('path')

        // Get project root (go up from packages/backend to project root)
        const projectRoot = resolve(process.cwd(), '../..')
        const templateDir = join(projectRoot, 'packages/worker/templates', templateVersion)

        // Recursively find all files in template directory
        async function findAllFiles(dir: string, baseDir: string): Promise<string[]> {
          const entries = await readdir(dir, { withFileTypes: true })
          const files = await Promise.all(
            entries.map(async (entry) => {
              const fullPath = join(dir, entry.name)
              if (entry.isDirectory()) {
                // Skip node_modules
                if (entry.name === 'node_modules') {
                  return []
                }
                return findAllFiles(fullPath, baseDir)
              } else {
                // Return relative path from baseDir
                return [relative(baseDir, fullPath)]
              }
            })
          )
          return files.flat()
        }

        const templateFiles = await findAllFiles(templateDir, templateDir)
        logger.info(`[Admin] Found ${templateFiles.length} files in template directory`)

        const filesToUpdate = templateFiles.map(filePath => ({
          local: join(templateVersion, filePath), // Destination path in worker repo (includes version dir)
          remote: join(templateVersion, filePath) // Source path in template repo
        }))

        // Add root .gitlab-ci.yml file (routes to versioned configs)
        const rootCiFilePath = '.gitlab-ci.yml'
        filesToUpdate.push({
          local: rootCiFilePath, // Destination: root of worker repo
          remote: rootCiFilePath // Source: root of templates directory
        })
        logger.info(`[Admin] Added root ${rootCiFilePath} to files list`)

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

            // Prepare all files for batch upload
            const filesToUploadBatch: Array<{ path: string; content: string }> = []
            const fileErrors: Array<{ file: string; error: string }> = []

            for (const file of filesToUpdate) {
              try {
                // Read from template directory using remote path (source)
                const filePath = join(projectRoot, 'packages/worker/templates', file.remote)
                logger.info(`[Admin] Reading file: ${filePath}`)
                const content = await readFile(filePath, 'utf-8')

                // Upload to worker repo using local path (destination)
                filesToUploadBatch.push({
                  path: file.local,
                  content,
                })

                logger.info(`[Admin] 📄 Prepared ${file.remote} → ${file.local}`)
              } catch (fileError) {
                const errorMsg = fileError instanceof Error ? fileError.message : String(fileError)
                logger.warn(`[Admin] Failed to read ${file.remote} for ${repo.project_name}:`, errorMsg)
                fileErrors.push({ file: file.local, error: errorMsg })
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
                    // Verify project exists and enable CI/CD
                    try {
                      logger.info(`[Admin] Verifying project ${repo.source_gitlab.project_id} exists and enabling CI/CD`)
                      await client.getProject(repo.source_gitlab.project_id)
                      await client.enableCICD(repo.source_gitlab.project_id)
                      await client.enableExternalPipelineVariables(repo.source_gitlab.project_id)
                      logger.info(`[Admin] ✓ CI/CD enabled for ${repo.project_name}`)
                    } catch (setupError) {
                      const setupErrorMsg = setupError instanceof Error ? setupError.message : String(setupError)
                      logger.warn(`[Admin] Failed to setup CI/CD for ${repo.project_name}:`, setupErrorMsg)
                      throw new Error(`CI/CD setup failed: ${setupErrorMsg}`)
                    }

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

                    logger.info(`[Admin] Triggering pipeline on project ${repo.source_gitlab.project_id} (${repo.source_gitlab.project_path})`)
                    const pipeline = await client.triggerPipeline(
                      repo.source_gitlab.project_id,
                      {
                        ref: 'main',
                        variables: pipelineVariables
                      }
                    )
                    logger.info(`[Admin] ✓ Pipeline #${pipeline.id} triggered for submodule sync: ${pipeline.web_url}`)
                  }
                } catch (pipelineError) {
                  const errorMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError)
                  logger.warn(`[Admin] Failed to trigger pipeline for ${repo.project_name} (project_id: ${repo.source_gitlab.project_id}):`, errorMsg)
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

    /**
     * Get API usage metrics
     * GET /admin/usage-metrics
     */
    .get('/usage-metrics', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      try {
        const { start_date, end_date, provider, goal } = c.req.query()

        // Build query fragments
        let whereClause = sql`WHERE 1=1`

        if (start_date) {
          whereClause = sql`${whereClause} AND created_at >= ${start_date}`
        }

        if (end_date) {
          whereClause = sql`${whereClause} AND created_at <= ${end_date}`
        }

        if (provider) {
          whereClause = sql`${whereClause} AND provider = ${provider}`
        }

        if (goal) {
          whereClause = sql`${whereClause} AND goal = ${goal}`
        }

        // Get aggregated metrics
        const metrics = await sql`
          SELECT
            provider,
            goal,
            operation_phase,
            DATE(created_at) as date,
            SUM(input_tokens + output_tokens + cache_creation_input_tokens + cache_read_input_tokens) as total_tokens,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            SUM(cache_creation_input_tokens) as cache_creation_tokens,
            SUM(cache_read_input_tokens) as cache_read_tokens,
            SUM(ci_duration_seconds) as total_ci_duration,
            COUNT(*) as api_calls
          FROM api_usage_metrics
          ${whereClause}
          GROUP BY provider, goal, operation_phase, DATE(created_at)
          ORDER BY date DESC, provider, goal
        `

        // Get detailed recent metrics (last 100)
        const recentMetrics = await sql`
          SELECT
            id,
            session_id,
            task_id,
            provider,
            model,
            goal,
            operation_phase,
            input_tokens,
            output_tokens,
            cache_creation_input_tokens,
            cache_read_input_tokens,
            ci_duration_seconds,
            iteration_number,
            created_at
          FROM api_usage_metrics
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT 100
        `

        return c.json({
          aggregated: metrics,
          recent: recentMetrics
        })
      } catch (error) {
        logger.error('[Admin] Failed to fetch usage metrics:', error)
        return c.json({ error: 'Failed to fetch usage metrics' }, 500)
      }
    })

    /**
     * Trigger pipeline status check
     * POST /admin/operations/check-stale-pipelines
     */
    .post('/operations/check-stale-pipelines', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      // Check admin access
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
        return c.json({ error: 'Admin privileges required' }, 403)
      }

      try {
        logger.info(`[Admin] Check stale pipelines triggered by user: ${userId}`)

        // Import dynamically to avoid circular dependency
        const { checkStalePipelines } = await import('../../micros-task-ops/monitoring/pipeline-monitor.ts')
        await checkStalePipelines({ sql })

        return c.json({
          success: true,
          message: 'Pipeline status check completed successfully'
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('[Admin] Failed to check stale pipelines:', errorMessage)

        return c.json({
          error: 'Failed to check stale pipelines',
          details: errorMessage
        }, 500)
      }
    })

    /**
     * Recover stuck tasks
     * POST /admin/operations/recover-stuck-tasks
     */
    .post('/operations/recover-stuck-tasks', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      // Check admin access
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
        return c.json({ error: 'Admin privileges required' }, 403)
      }

      try {
        logger.info(`[Admin] Recover stuck tasks triggered by user: ${userId}`)

        // Import dynamically to avoid circular dependency
        const { recoverStuckEvaluationsFromDatabase } = await import('../../micros-task-ops/core/evaluation-sync-service.ts')
        const result = await recoverStuckEvaluationsFromDatabase(sql, 30)

        return c.json({
          success: true,
          message: `Recovered ${result.tasksRecovered} stuck tasks (${result.errors.length} errors)`,
          tasksRecovered: result.tasksRecovered,
          errors: result.errors
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('[Admin] Failed to recover stuck tasks:', errorMessage)

        return c.json({
          error: 'Failed to recover stuck tasks',
          details: errorMessage
        }, 500)
      }
    })

    /**
     * Create missing worker repositories
     * POST /admin/operations/create-missing-worker-repos
     */
    .post('/operations/create-missing-worker-repos', async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      // Check admin access
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
        return c.json({ error: 'Admin privileges required' }, 403)
      }

      try {
        logger.info(`[Admin] Create missing worker repositories triggered by user: ${userId}`)

        // Validate environment
        const requiredEnv = ['GITLAB_HOST', 'GITLAB_TOKEN', 'GITLAB_USER', 'ENCRYPTION_KEY']
        const missing = requiredEnv.filter((key) => !process.env[key])

        if (missing.length > 0) {
          return c.json(
            { error: `Missing required environment variables: ${missing.join(', ')}` },
            500
          )
        }

        // Find all projects without worker repositories
        const projectsWithoutRepos = await sql`
          SELECT p.id, p.name
          FROM projects p
          LEFT JOIN worker_repositories wr ON wr.project_id = p.id
          WHERE wr.id IS NULL
          ORDER BY p.name
        `

        if (projectsWithoutRepos.length === 0) {
          logger.info('[Admin] All projects already have worker repositories')
          return c.json({
            success: true,
            message: 'All projects already have worker repositories',
            created: 0,
            results: []
          })
        }

        logger.info(`[Admin] Found ${projectsWithoutRepos.length} projects without worker repositories - starting background creation`)

        // Return immediately and process in background to avoid timeout
        // Start background processing
        const processInBackground = async () => {
          const { CIRepositoryManager } = await import('../../worker/ci-repository-manager.ts')
          const manager = new CIRepositoryManager()
          const version = '2025-10-18-01'

          let successCount = 0
          let failCount = 0

          // Create worker repository for each project
          for (const project of projectsWithoutRepos) {
            try {
              logger.info(`[Admin] Creating worker repository for project: ${project.name}`)

              const customPath = `adi-worker-${project.name.toLowerCase()}`

              // Create worker repository in GitLab
              const source = await manager.createWorkerRepository({
                projectName: project.name,
                sourceType: 'gitlab',
                host: process.env.GITLAB_HOST!,
                accessToken: process.env.GITLAB_TOKEN!,
                user: process.env.GITLAB_USER!,
                customPath,
              })

              logger.info(`[Admin] Created GitLab repository: ${source.project_path}`)

              // Upload CI files
              await manager.uploadCIFiles({
                source,
                version,
              })

              logger.info(`[Admin] Uploaded CI files (version: ${version})`)

              // Save to database
              await sql`
                INSERT INTO worker_repositories (project_id, source_gitlab, current_version)
                VALUES (${project.id}, ${source as any}, ${version})
              `

              logger.info(`[Admin] ✓ Created worker repository for ${project.name}`)
              successCount++
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              logger.error(`[Admin] Failed to create worker repository for ${project.name}:`, errorMessage)
              failCount++
            }
          }

          logger.info(`[Admin] Worker repository creation complete: ${successCount} succeeded, ${failCount} failed`)
        }

        // Don't await - let it run in background
        processInBackground().catch((error) => {
          logger.error('[Admin] Background worker repository creation failed:', error)
        })

        return c.json({
          success: true,
          message: `Creating ${projectsWithoutRepos.length} worker repositories in the background. Check server logs for progress.`,
          processing: projectsWithoutRepos.length
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('[Admin] Failed to create missing worker repositories:', errorMessage)

        return c.json({
          error: 'Failed to create missing worker repositories',
          details: errorMessage
        }, 500)
      }
    })
}
