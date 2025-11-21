import type { Sql } from 'postgres'
import { z } from 'zod'
import { handler, type HandlerContext } from '@adi-family/http'
import { getUsageMetricsConfig, getWorkerReposConfig, refreshWorkerReposConfig } from '@adi/api-contracts/admin'
import { findRecentUsageMetrics, findAggregatedUsageMetrics } from '@adi-simple/db/api-usage-metrics'
import { findWorkerRepositoryStatus } from '@adi-simple/db/worker-repositories'
import { CIRepositoryManager } from '@adi-simple/worker/ci-repository-manager'
import { createLogger } from '@utils/logger'
import * as userAccessQueries from '@db/user-access'
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'

const logger = createLogger({ namespace: 'admin-handler' })

const _workerRepositoryRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  project_name: z.string(),
  current_version: z.string(),
  source_gitlab: z.any()
})

type WorkerRepositoryRow = z.infer<typeof _workerRepositoryRowSchema>

const _refreshResultSchema = z.object({
  project: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  filesUpdated: z.number().optional(),
  fileErrors: z.array(z.object({
    file: z.string(),
    error: z.string()
  })).optional()
})

type RefreshResult = z.infer<typeof _refreshResultSchema>

export function createAdminHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: No Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw new Error('Unauthorized: Invalid token format')
    }

    if (!CLERK_SECRET_KEY) {
      throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
    }

    try {
      const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
      if (!payload.sub) {
        throw new Error('Unauthorized: Invalid token payload')
      }
      return payload.sub
    } catch (error) {
      logger.error('Token verification failed:', error)
      throw new Error('Unauthorized: Token verification failed')
    }
  }

  async function verifyAdminAccess(userId: string): Promise<void> {
    const hasAdminAccess = await userAccessQueries.hasAdminAccess(sql, userId)
    if (!hasAdminAccess) {
      throw new Error('Forbidden: Admin access required. You must be an owner or admin of at least one project.')
    }
  }

  const getUsageMetrics = handler(getUsageMetricsConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    await verifyAdminAccess(userId)

    const { query } = ctx
    const filters = {
      start_date: query?.start_date,
      end_date: query?.end_date,
      provider: query?.provider,
      goal: query?.goal,
    }

    const limit = query?.limit ?? 100;

    const [recent, aggregated] = await Promise.all([
      findRecentUsageMetrics(sql, filters, limit),
      findAggregatedUsageMetrics(sql, filters),
    ])

    return {
      recent,
      aggregated,
    }
  })

  const getWorkerRepos = handler(getWorkerReposConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    await verifyAdminAccess(userId)

    const repositories = await findWorkerRepositoryStatus(sql)
    return { repositories }
  })

  const refreshWorkerRepos = handler(refreshWorkerReposConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    await verifyAdminAccess(userId)

    logger.info('Starting worker repository refresh...')

    const repositories = await sql<WorkerRepositoryRow[]>`
      SELECT
        wr.id,
        wr.project_id,
        wr.current_version,
        wr.source_gitlab,
        p.name as project_name
      FROM worker_repositories wr
      JOIN projects p ON p.id = wr.project_id
      ORDER BY p.name
    `

    if (repositories.length === 0) {
      return {
        success: true,
        message: 'No worker repositories found',
        results: [],
        summary: {
          total: 0,
          succeeded: 0,
          failed: 0
        }
      }
    }

    const manager = new CIRepositoryManager()
    const results: RefreshResult[] = []

    let successCount = 0
    let failedCount = 0

    for (const repo of repositories) {
      logger.info(`\n📤 Refreshing repository for project: ${repo.project_name}`)

      try {
        const source = repo.source_gitlab as any

        if (!source || source.type !== 'gitlab') {
          const error = 'Invalid or missing GitLab source'
          logger.warn(`⚠️  ${error}`)
          results.push({
            project: repo.project_name,
            success: false,
            error
          })
          failedCount++
          continue
        }

        if (!repo.current_version) {
          const error = 'No current version set'
          logger.warn(`⚠️  ${error}`)
          results.push({
            project: repo.project_name,
            success: false,
            error
          })
          failedCount++
          continue
        }

        logger.info(`   Version: ${repo.current_version}`)
        logger.info(`   Project: ${source.project_path}`)
        logger.info(`   Host: ${source.host}`)

        // Force upload CI files
        const uploadedFiles = await manager.uploadCIFiles({
          source: source,
          version: repo.current_version,
          force: true,
        })

        logger.info(`    Successfully uploaded ${uploadedFiles} file(s)`)
        results.push({
          project: repo.project_name,
          success: true,
          filesUpdated: uploadedFiles
        })
        successCount++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`    Failed to refresh repository:`, error)
        results.push({
          project: repo.project_name,
          success: false,
          error: errorMessage
        })
        failedCount++
      }
    }

    const message = `Refresh complete: ${successCount} succeeded, ${failedCount} failed`
    logger.info(`\n ${message}`)

    return {
      success: successCount > 0 || failedCount === 0,
      message,
      results,
      summary: {
        total: repositories.length,
        succeeded: successCount,
        failed: failedCount
      }
    }
  })

  return {
    getUsageMetrics,
    getWorkerRepos,
    refreshWorkerRepos
  }
}
