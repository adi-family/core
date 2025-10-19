/**
 * Pipeline Monitor
 * Monitors running GitLab pipelines and syncs status to database
 */

import type { BackendClient } from './api-client'
import { GitLabApiClient } from './gitlab-api-client'
import { decrypt } from './crypto-utils'
import { retry, isRetryableError } from '../utils/retry'
import { createLogger } from '../utils/logger'

const logger = createLogger({ namespace: 'pipeline-monitor' })

export interface PipelineMonitorConfig {
  timeoutMinutes?: number
  pollIntervalMs?: number
  apiClient?: BackendClient
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
  config: PipelineMonitorConfig = {}
): Promise<void> {
  const timeoutMinutes =
    config.timeoutMinutes ||
    parseInt(process.env.PIPELINE_STATUS_TIMEOUT_MINUTES || '') ||
    DEFAULT_TIMEOUT_MINUTES

  logger.info(`🔍 Checking for stale pipelines (timeout: ${timeoutMinutes} minutes)`)

  if (!config.apiClient) {
    throw new Error('API client is required for checking stale pipelines')
  }

  // Find stale pipeline executions
  const staleRes = await config.apiClient['pipeline-executions'].stale.$get({
    query: { timeoutMinutes: String(timeoutMinutes) }
  })
  if (!staleRes.ok) {
    throw new Error('Failed to fetch stale pipeline executions')
  }
  const stalePipelines = await staleRes.json()

  if (stalePipelines.length === 0) {
    logger.info('✓ No stale pipelines found')
    return
  }

  logger.warn(`⚠️  Found ${stalePipelines.length} stale pipeline(s)`)

  for (const execution of stalePipelines) {
    try {
      await updatePipelineStatus(execution.id, config.apiClient)
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
export async function updatePipelineStatus(executionId: string, apiClient: BackendClient): Promise<void> {
  logger.info(`📊 Updating status for pipeline execution ${executionId}`)

  try {
    // Fetch pipeline execution
    const execRes = await apiClient['pipeline-executions'][':id'].$get({ param: { id: executionId } })
    if (!execRes.ok) {
      throw new Error(`Pipeline execution not found: ${executionId}`)
    }
    const execution = await execRes.json()

    // Validate execution has pipeline_id
    if (!execution.pipeline_id) {
      logger.warn(
        `⚠️  Pipeline execution ${executionId} has no pipeline_id, skipping status update`
      )
      return
    }

    // Fetch worker repository
    const workerRepoRes = await apiClient['worker-repositories'][':id'].$get({ param: { id: execution.worker_repository_id } })
    if (!workerRepoRes.ok) {
      throw new Error(
        `Worker repository not found: ${execution.worker_repository_id}`
      )
    }
    const workerRepo = await workerRepoRes.json()

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

    if (!source.project_id || !source.host || !source.access_token_encrypted) {
      throw new Error(
        `Invalid worker repository source configuration. Missing required fields: ${[
          !source.project_id && 'project_id',
          !source.host && 'host',
          !source.access_token_encrypted && 'access_token_encrypted',
        ].filter(Boolean).join(', ')}`
      )
    }

    // Decrypt access token
    let accessToken: string
    try {
      accessToken = decrypt(source.access_token_encrypted)
    } catch (error) {
      throw new Error(
        `Failed to decrypt GitLab access token. Please check ENCRYPTION_KEY environment variable. Error: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // Fetch pipeline status from GitLab with retry logic
    const gitlabClient = new GitLabApiClient(source.host, accessToken)

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

      const updateRes = await apiClient['pipeline-executions'][':id'].$patch({
        param: { id: execution.id },
        json: {
          status: newStatus,
          last_status_update: new Date().toISOString(),
        }
      })

      if (!updateRes.ok) {
        throw new Error(
          `Failed to update pipeline execution ${execution.id} status to ${newStatus}`
        )
      }

      logger.info(`✓ Updated pipeline execution status to: ${newStatus}`)
    } else {
      logger.info(`  No status change (still ${execution.status})`)

      // Update last_status_update timestamp even if status didn't change
      await apiClient['pipeline-executions'][':id'].$patch({
        param: { id: execution.id },
        json: {
          last_status_update: new Date().toISOString(),
        }
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      `❌ Failed to update pipeline status for execution ${executionId}: ${errorMessage}`
    )
    throw error
  }
}

/**
 * Start periodic monitoring of stale pipelines
 */
export function startPipelineMonitor(
  config: PipelineMonitorConfig = {}
): NodeJS.Timeout {
  const pollIntervalMs =
    config.pollIntervalMs ||
    parseInt(process.env.PIPELINE_POLL_INTERVAL_MS || '') ||
    DEFAULT_POLL_INTERVAL_MS

  logger.info(
    `🔄 Starting pipeline monitor (interval: ${pollIntervalMs / 1000}s)`
  )

  const intervalId = setInterval(async () => {
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

  return intervalId
}

/**
 * Stop pipeline monitor
 */
export function stopPipelineMonitor(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId)
  logger.info('⏹️  Pipeline monitor stopped')
}
