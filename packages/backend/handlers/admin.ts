/**
 * Admin Operations Handler
 * Provides administrative endpoints for system management
 */

import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { decrypt } from '@shared/crypto-utils'
import { createLogger } from '@utils/logger'
import { getAllFiles } from '@utils/file-system'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { checkStalePipelines } from '../../micros-task-ops/monitoring/pipeline-monitor.ts'
import { recoverStuckEvaluationsFromDatabase } from '../../micros-task-ops/core/evaluation-sync-service.ts'
import { CIRepositoryManager } from '@worker/ci-repository-manager.ts'
import { reqAdminAuthed, reqAuthed } from '../middleware/authz'
import * as workerRepoQueries from '@db/worker-repositories'
import * as apiUsageMetricsQueries from '@db/api-usage-metrics'
import { backendConfig } from "@utils/backend-config.ts"
import {
  API_BASE_URL,
  API_TOKEN,
  GITLAB_TOKEN,
  GITLAB_HOST,
  GITLAB_USER,
  ENCRYPTION_KEY
} from '@backend/config'

const logger = createLogger({ namespace: 'admin' })

export const createAdminRoutes = (sql: Sql) => {
  return new Hono()
    .post('/refresh-worker-repos', async (c) => {
      const userId = await reqAdminAuthed(c, sql);
      logger.info(`Worker repository refresh triggered by user: ${userId}`)

      try {
        const repos = await workerRepoQueries.findWorkerRepositoriesWithProjects(sql)

        if (repos.length === 0) {
          logger.warn('No worker repositories found')
          return c.json({
            success: true,
            message: 'No worker repositories to refresh',
            results: []
          })
        }

        logger.info(`Found ${repos.length} worker repositories to refresh`)

        const projectRoot = resolve(process.cwd(), '../..')
        const templateDir = join(projectRoot, 'packages/worker/templates', backendConfig.templateVersion)

        const templateFiles = await getAllFiles(templateDir, templateDir)
        logger.info(`Found ${templateFiles.length} files in template directory`)

        const filesToUpdate = templateFiles.map(filePath => ({
          local: join(backendConfig.templateVersion, filePath), // Destination path in worker repo (includes version dir)
          remote: join(backendConfig.templateVersion, filePath) // Source path in template repo
        }))

        // Add root .gitlab-ci.yml file (routes to versioned configs)
        const rootCiFilePath = '.gitlab-ci.yml'
        filesToUpdate.push({
          local: rootCiFilePath, // Destination: root of worker repo
          remote: rootCiFilePath // Source: root of templates directory
        })
        logger.info(`Added root ${rootCiFilePath} to files list`)

        const results: Array<{
          project: string
          success: boolean
          error?: string
          filesUpdated?: number
        }> = []

        // Update each repository
        for (const repo of repos) {
          try {
            logger.info(`Refreshing: ${repo.project_name}`)

            const accessToken = decrypt(repo.source_gitlab.access_token_encrypted)
            const client = new GitLabApiClient(repo.source_gitlab.host, accessToken)

            const filesToUploadBatch: Array<{ path: string; content: string }> = []
            const fileErrors: Array<{ file: string; error: string }> = []

            for (const file of filesToUpdate) {
              const filePath = join(projectRoot, 'packages/worker/templates', file.remote)
              logger.info(`Reading file: ${filePath}`)
              const content = await readFile(filePath, 'utf-8')

              filesToUploadBatch.push({
                path: file.local,
                content,
              })

              logger.info(`📄 Prepared ${file.remote} → ${file.local}`)
            }

            // Upload all files in a single batch commit
            let uploadedCount = 0
            if (filesToUploadBatch.length > 0) {
              try {
                const commitMessage = `Admin refresh: Update ${filesToUploadBatch.length} files`
                logger.info(`Uploading ${filesToUploadBatch.length} files in batch to ${repo.source_gitlab.project_id}`)
                await client.uploadFiles(
                  repo.source_gitlab.project_id,
                  filesToUploadBatch,
                  commitMessage,
                  'main'
                )
                uploadedCount = filesToUploadBatch.length
                logger.info(`✓ Batch uploaded ${uploadedCount} files in a single commit`)

                try {
                  logger.info(`Triggering pipeline to sync submodules for ${repo.project_name}`)

                  const apiBaseUrl = API_BASE_URL
                  const apiToken = API_TOKEN
                  const gitlabToken = GITLAB_TOKEN

                  if (!apiToken) {
                    logger.warn(`API_TOKEN not set, skipping submodule sync for ${repo.project_name}`)
                  } else {
                    // Verify project exists and enable CI/CD
                    try {
                      logger.info(`Verifying project ${repo.source_gitlab.project_id} exists and enabling CI/CD`)
                      await client.getProject(repo.source_gitlab.project_id)
                      await client.enableCICD(repo.source_gitlab.project_id)
                      await client.enableExternalPipelineVariables(repo.source_gitlab.project_id)
                      logger.info(`✓ CI/CD enabled for ${repo.project_name}`)
                    } catch (setupError) {
                      const setupErrorMsg = setupError instanceof Error ? setupError.message : String(setupError)
                      logger.warn(`Failed to setup CI/CD for ${repo.project_name}:`, setupErrorMsg)
                      throw new Error(`CI/CD setup failed: ${setupErrorMsg}`)
                    }

                    const pipelineVariables: Record<string, string> = {
                      PROJECT_ID: repo.project_id,
                      API_BASE_URL: apiBaseUrl,
                      API_TOKEN: apiToken,
                      SYNC_ONLY: 'true',
                    }

                    if (gitlabToken) {
                      pipelineVariables.GITLAB_TOKEN = gitlabToken
                    }

                    // Add WORKER_REPO_TOKEN - the access token for this specific worker repository
                    // This token has write permissions to push changes back to the worker repo
                    pipelineVariables.WORKER_REPO_TOKEN = accessToken

                    logger.info(`Triggering pipeline on project ${repo.source_gitlab.project_id} (${repo.source_gitlab.project_path})`)
                    const pipeline = await client.triggerPipeline(
                      repo.source_gitlab.project_id,
                      {
                        ref: 'main',
                        variables: pipelineVariables
                      }
                    )
                    logger.info(`✓ Pipeline #${pipeline.id} triggered for submodule sync: ${pipeline.web_url}`)
                  }
                } catch (pipelineError) {
                  const errorMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError)
                  logger.warn(`Failed to trigger pipeline for ${repo.project_name} (project_id: ${repo.source_gitlab.project_id}):`, errorMsg)
                  // Don't add to fileErrors as this is not critical - submodules will sync on next regular pipeline run
                }
              } catch (uploadError) {
                const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError)
                logger.error(`Failed to batch upload files for ${repo.project_name}:`, errorMsg)
                fileErrors.push({ file: 'batch upload', error: errorMsg })
              }
            }

            results.push({
              project: repo.project_name,
              success: true,
              filesUpdated: uploadedCount,
              ...(fileErrors.length > 0 && { fileErrors })
            } as any)

            logger.info(`✓ Refreshed ${repo.project_name} (${uploadedCount} files, ${fileErrors.length} errors)`)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error(`Failed to refresh ${repo.project_name}:`, errorMessage)

            results.push({
              project: repo.project_name,
              success: false,
              error: errorMessage
            })
          }
        }

        const successCount = results.filter(r => r.success).length
        const failCount = results.filter(r => !r.success).length

        logger.info(`Refresh complete: ${successCount} succeeded, ${failCount} failed`)

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
        logger.error('Worker repository refresh failed:', errorMessage)

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
      await reqAuthed(c);

      try {
        const repos = await workerRepoQueries.findWorkerRepositoryStatus(sql)
        return c.json({ repositories: repos })
      } catch (error) {
        logger.error('Failed to fetch worker repositories:', error)
        return c.json({ error: 'Failed to fetch worker repositories' }, 500)
      }
    })

    /**
     * Get API usage metrics
     * GET /admin/usage-metrics
     */
    .get('/usage-metrics', async (c) => {
      await reqAuthed(c);

      try {
        const { start_date, end_date, provider, goal } = c.req.query()

        const filters = { start_date, end_date, provider, goal }

        const metrics = await apiUsageMetricsQueries.findAggregatedUsageMetrics(sql, filters)
        const recentMetrics = await apiUsageMetricsQueries.findRecentUsageMetrics(sql, filters, 100)

        return c.json({
          aggregated: metrics,
          recent: recentMetrics
        })
      } catch (error) {
        logger.error('Failed to fetch usage metrics:', error)
        return c.json({ error: 'Failed to fetch usage metrics' }, 500)
      }
    })

    .post('/operations/check-stale-pipelines', async (c) => {
      const userId = await reqAdminAuthed(c, sql);

      try {
        logger.info(`Check stale pipelines triggered by user: ${userId}`)

        await checkStalePipelines({ sql })

        return c.json({
          success: true,
          message: 'Pipeline status check completed successfully'
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to check stale pipelines:', errorMessage)

        return c.json({
          error: 'Failed to check stale pipelines',
          details: errorMessage
        }, 500)
      }
    })

    .post('/operations/recover-stuck-tasks', async (c) => {
      const userId = await reqAdminAuthed(c, sql);

      try {
        logger.info(`Recover stuck tasks triggered by user: ${userId}`)

        const result = await recoverStuckEvaluationsFromDatabase(sql, 30)

        return c.json({
          success: true,
          message: `Recovered ${result.tasksRecovered} stuck tasks (${result.errors.length} errors)`,
          tasksRecovered: result.tasksRecovered,
          errors: result.errors
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to recover stuck tasks:', errorMessage)

        return c.json({
          error: 'Failed to recover stuck tasks',
          details: errorMessage
        }, 500)
      }
    })

    .post('/operations/create-missing-worker-repos', async (c) => {
      const userId = await reqAdminAuthed(c, sql);

      try {
        logger.info(`Create missing worker repositories triggered by user: ${userId}`)

        // Validate environment
        const requiredConfigs = {
          GITLAB_HOST,
          GITLAB_TOKEN,
          GITLAB_USER,
          ENCRYPTION_KEY
        }
        const missing = Object.entries(requiredConfigs)
          .filter(([_, value]) => !value)
          .map(([key]) => key)

        if (missing.length > 0) {
          return c.json(
            { error: `Missing required environment variables: ${missing.join(', ')}` },
            500
          )
        }

        // Find all projects without worker repositories
        const projectsWithoutRepos = await workerRepoQueries.findProjectsWithoutWorkerRepositories(sql)

        if (projectsWithoutRepos.length === 0) {
          logger.info('All projects already have worker repositories')
          return c.json({
            success: true,
            message: 'All projects already have worker repositories',
            created: 0,
            results: []
          })
        }

        logger.info(`Found ${projectsWithoutRepos.length} projects without worker repositories - starting background creation`)

        // Return immediately and process in background to avoid timeout
        // Start background processing
        const processInBackground = async () => {
          const manager = new CIRepositoryManager()
          const version = '2025-10-18-01'

          let successCount = 0
          let failCount = 0

          // Create worker repository for each project
          for (const project of projectsWithoutRepos) {
            try {
              logger.info(`Creating worker repository for project: ${project.name}`)

              const customPath = `adi-worker-${project.name.toLowerCase()}`

              // Create worker repository in GitLab
              const source = await manager.createWorkerRepository({
                projectName: project.name,
                sourceType: 'gitlab',
                host: GITLAB_HOST,
                accessToken: GITLAB_TOKEN,
                user: GITLAB_USER,
                customPath,
              })

              logger.info(`Created GitLab repository: ${source.project_path}`)

              // Upload CI files
              await manager.uploadCIFiles({
                source,
                version,
              })

              logger.info(`Uploaded CI files (version: ${version})`)

              // Save to database
              await workerRepoQueries.createWorkerRepository(sql, {
                project_id: project.id,
                source_gitlab: source as any,
                current_version: version,
              })

              logger.info(`✓ Created worker repository for ${project.name}`)
              successCount++
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              logger.error(`Failed to create worker repository for ${project.name}:`, errorMessage)
              failCount++
            }
          }

          logger.info(`Worker repository creation complete: ${successCount} succeeded, ${failCount} failed`)
        }

        // Don't await - let it run in background
        processInBackground().catch((error) => {
          logger.error('Background worker repository creation failed:', error)
        })

        return c.json({
          success: true,
          message: `Creating ${projectsWithoutRepos.length} worker repositories in the background. Check server logs for progress.`,
          processing: projectsWithoutRepos.length
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to create missing worker repositories:', errorMessage)

        return c.json({
          error: 'Failed to create missing worker repositories',
          details: errorMessage
        }, 500)
      }
    })
}
