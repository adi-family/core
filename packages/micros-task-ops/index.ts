/**
 * Micros-Task-Ops Service - Standalone Entry Point
 * Dedicated microservice for all task-related operations:
 * - Task source sync scheduling
 * - Evaluation scheduling
 * - Pipeline monitoring
 * - Stuck evaluation recovery
 *
 * Uses ONLY direct database access (no API calls)
 */

import { sql } from '@db/client'
import { createLogger } from '@utils/logger'
import { loadConfig, logConfig } from './config'
import { startSyncScheduler, stopSyncScheduler } from './scheduling/sync-scheduler'
import { startEvalScheduler, stopEvalScheduler } from './scheduling/eval-scheduler'
import { startPipelineMonitor, stopPipelineMonitor } from './monitoring/pipeline-monitor'
import { startEvaluationRecovery, stopEvaluationRecovery } from './monitoring/evaluation-recovery'

const logger = createLogger({ namespace: 'micros-task-ops' })

// Validate environment variables
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required')
  process.exit(1)
}

// Load configuration
const config = loadConfig()

logger.info('Starting Micros-Task-Ops service...')
logConfig(config)

// Store timer references for graceful shutdown
let syncTimer: NodeJS.Timeout | null = null
let evalTimer: NodeJS.Timeout | null = null
let pipelineTimer: NodeJS.Timeout | null = null
let recoveryTimer: NodeJS.Timeout | null = null

try {
  // Start all schedulers and monitors (using DB only)
  syncTimer = startSyncScheduler(
    sql,
    config.syncIntervalMinutes,
    config.syncThresholdMinutes,
    config.queuedTimeoutMinutes
  )

  evalTimer = startEvalScheduler(
    sql,
    config.evalIntervalMinutes
  )

  pipelineTimer = startPipelineMonitor({
    pollIntervalMs: config.pipelinePollIntervalMs,
    timeoutMinutes: config.pipelineTimeoutMinutes,
    sql
  })

  recoveryTimer = startEvaluationRecovery({
    sql,
    timeoutMinutes: config.stuckEvalTimeoutMinutes,
    checkIntervalMs: config.stuckEvalCheckIntervalMinutes * 60 * 1000
  })

  logger.info('✅ Micros-Task-Ops service started successfully')
  logger.info('All task operations are now running (using direct DB access):')
  logger.info('  ✓ Task source sync scheduler')
  logger.info('  ✓ Evaluation scheduler')
  logger.info('  ✓ Pipeline monitor')
  logger.info('  ✓ Evaluation recovery')

} catch (error) {
  logger.error('Failed to start Micros-Task-Ops service:', error)
  process.exit(1)
}

// Graceful shutdown handlers
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`)

  if (syncTimer) {
    stopSyncScheduler(syncTimer)
  }
  if (evalTimer) {
    stopEvalScheduler(evalTimer)
  }
  if (pipelineTimer) {
    stopPipelineMonitor(pipelineTimer)
  }
  if (recoveryTimer) {
    stopEvaluationRecovery(recoveryTimer)
  }

  sql.end().then(() => {
    logger.info('Database connection closed')
    logger.info('✅ Micros-Task-Ops service stopped')
    process.exit(0)
  }).catch((error) => {
    logger.error('Error closing database connection:', error)
    process.exit(1)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason)
  process.exit(1)
})
