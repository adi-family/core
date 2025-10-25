/**
 * Pipeline Monitor
 * Monitors running GitLab pipelines and syncs status to database
 * Uses ONLY direct database access (no API calls)
 */

import type { Sql } from 'postgres'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { retry, isRetryableError } from '@utils/retry'
import { createLogger } from '@utils/logger'
import { validateGitLabSource, decryptGitLabToken } from '@backend/worker-orchestration/gitlab-utils'
import { syncTaskEvaluationStatus } from '../core/evaluation-sync-service'
import * as pipelineExecutionQueries from '@db/pipeline-executions'
import * as workerRepositoryQueries from '@db/worker-repositories'

const logger = createLogger({ namespace: 'pipeline-monitor' })

export interface PipelineMonitorConfig {
  timeoutMinutes?: number
  pollIntervalMs?: number
  sql: Sql
}

const DEFAULT_TIMEOUT_MINUTES = 30
const DEFAULT_POLL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Map GitLab pipeline status to our status enum
 */
function mapGitLabStatus(
  gitlabStatus: string
): 'pending' | 'running' | 'success' | 'failed' | 'canceled' {
  switch (gitlabStatus) {
    case 'created':
    case 'waiting_for_resource':
    case 'preparing':
    case 'pending':
      return 'pending'
    case 'running':
      return 'running'
    case 'success':
      return 'success'
    case 'failed':
      return 'failed'
    case 'canceled':
    case 'skipped':
    case 'manual':
      return 'canceled'
    default:
      logger.warn(`Unknown GitLab pipeline status: ${gitlabStatus}`)
      return 'failed'
  }
}

/**
 * Check and update stale pipeline statuses
 * This is the fallback mechanism when pipelines don't report status
 */
export async function checkStalePipelines(
  config: PipelineMonitorConfig
): Promise<void> {
  const timeoutMinutes =
    config.timeoutMinutes ||
    parseInt(process.env.PIPELINE_STATUS_TIMEOUT_MINUTES || '') ||
    DEFAULT_TIMEOUT_MINUTES

  logger.info(`🔍 Checking for stale pipelines (timeout: ${timeoutMinutes} minutes)`)

  if (!config.sql) {
    throw new Error('SQL connection is required for checking stale pipelines')
  }

  // Find stale pipeline executions (direct DB)
  const stalePipelines = await pipelineExecutionQueries.findStalePipelineExecutions(
    config.sql,
    timeoutMinutes
  )

  if (stalePipelines.length === 0) {
    logger.info('✓ No stale pipelines found')
    return
  }

  logger.warn(`⚠️  Found ${stalePipelines.length} stale pipeline(s)`)

  for (const execution of stalePipelines) {
    try {
      await updatePipelineStatus(execution.id, config.sql)
    } catch (error) {
      logger.error(
        `Failed to update stale pipeline ${execution.id}:`,
        error
      )
    }
  }

  logger.info(`✅ Finished checking stale pipelines`)
}

/**
 * Update pipeline status from GitLab
 */
export async function updatePipelineStatus(executionId: string, sql: Sql): Promise<void> {
  logger.info(`📊 Updating status for pipeline execution ${executionId}`)

  try {
    // Fetch pipeline execution (direct DB)
    const execResult = await pipelineExecutionQueries.findPipelineExecutionById(sql, executionId)
    if (!execResult.ok) {
      throw new Error(`Pipeline execution not found: ${executionId}`)
    }
    const execution = execResult.data

    // Validate execution has pipeline_id
    if (!execution.pipeline_id) {
      logger.warn(
        `⚠️  Pipeline execution ${executionId} has no pipeline_id, skipping status update`
      )
      return
    }

    // Fetch worker repository (direct DB)
    const workerRepoResult = await workerRepositoryQueries.findWorkerRepositoryById(
      sql,
      execution.worker_repository_id
    )
    if (!workerRepoResult.ok) {
      throw new Error(
        `Worker repository not found: ${execution.worker_repository_id}`
      )
    }
    const workerRepo = workerRepoResult.data

    // Parse source from JSONB
    const source = workerRepo.source_gitlab as unknown as {
      type: string
      project_id?: string
      host?: string
      access_token_encrypted?: string
    }

    // Validate source configuration
    if (source.type !== 'gitlab') {
      throw new Error(
        `Unsupported worker repository type: ${source.type}. Only 'gitlab' is currently supported.`
      )
    }

    validateGitLabSource(source)

    // Decrypt access token
    const accessToken = decryptGitLabToken(source.access_token_encrypted!)

    // Fetch pipeline status from GitLab with retry logic
    const gitlabClient = new GitLabApiClient(source.host!, accessToken)

    const pipeline = await retry(
      async () => {
        return await gitlabClient.getPipeline(
          source.project_id!,
          execution.pipeline_id!
        )
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          if (isRetryableError(error)) {
            logger.warn(
              `⚠️  Failed to fetch pipeline status (attempt ${attempt}/3): ${error.message}. Retrying...`
            )
          } else {
            logger.error(
              `❌ Non-retryable error: ${error.message}. Aborting.`
            )
            throw error
          }
        },
      }
    )

    logger.info(
      `✓ GitLab pipeline ${pipeline.id} status: ${pipeline.status}`
    )

    // Map GitLab status to our status
    const newStatus = mapGitLabStatus(pipeline.status)

    // Update if status changed
    if (newStatus !== execution.status) {
      logger.info(
        `  Status changed: ${execution.status} → ${newStatus}`
      )

      // Update pipeline execution (direct DB)
      const updateResult = await pipelineExecutionQueries.updatePipelineExecution(sql, execution.id, {
        status: newStatus,
        last_status_update: new Date().toISOString(),
      })

      if (!updateResult.ok) {
        throw new Error(
          `Failed to update pipeline execution ${execution.id} status to ${newStatus}`
        )
      }

      logger.info(`✓ Updated pipeline execution status to: ${newStatus}`)

      // Sync task evaluation status if pipeline completed (using DB)
      await syncTaskEvaluationStatus(sql, execution, newStatus)
    } else {
      logger.info(`  No status change (still ${execution.status})`)

      // Update last_status_update timestamp even if status didn't change (direct DB)
      await pipelineExecutionQueries.updatePipelineExecution(sql, execution.id, {
        last_status_update: new Date().toISOString(),
      })

      // Also try to sync task status for completed pipelines we just discovered (using DB)
      if (['success', 'failed', 'canceled'].includes(execution.status)) {
        await syncTaskEvaluationStatus(sql, execution, execution.status as 'success' | 'failed' | 'canceled')
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      `❌ Failed to update pipeline status for execution ${executionId}: ${errorMessage}`
    )
    throw error
  }
}

export interface Runner {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

/**
 * Create pipeline monitor runner
 */
export function createPipelineMonitor(
  config: PipelineMonitorConfig
): Runner {
  const pollIntervalMs =
    config.pollIntervalMs ||
    parseInt(process.env.PIPELINE_POLL_INTERVAL_MS || '') ||
    DEFAULT_POLL_INTERVAL_MS

  let intervalId: NodeJS.Timeout | null = null

  return {
    start: () => {
      if (intervalId) {
        logger.warn('Pipeline monitor already running')
        return
      }

      logger.info(
        `🔄 Starting pipeline monitor (interval: ${pollIntervalMs / 1000}s)`
      )

      intervalId = setInterval(async () => {
        try {
          await checkStalePipelines(config)
        } catch (error) {
          logger.error('Pipeline monitor error:', error)
        }
      }, pollIntervalMs)

      // Run immediately on start
      checkStalePipelines(config).catch((error) => {
        logger.error('Pipeline monitor initial run error:', error)
      })
    },

    stop: () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
        logger.info('⏹️  Pipeline monitor stopped')
      }
    }
  }
}
