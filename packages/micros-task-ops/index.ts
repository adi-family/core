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
import { createSyncScheduler, type Runner } from './scheduling/sync-scheduler'
import { createEvalScheduler } from './scheduling/eval-scheduler'
import { createPipelineMonitor } from './monitoring/pipeline-monitor'
import { createEvaluationRecovery } from './monitoring/evaluation-recovery'
import { createTaskSyncConsumer, createTaskEvalConsumer, createTaskImplConsumer } from './consumer'

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

// Create all runners with labels
interface LabeledRunner extends Runner {
  label: string
}

const runners: LabeledRunner[] = [
  // Queue consumers
  { label: 'TaskSyncConsumer', ...createTaskSyncConsumer(sql) },
  { label: 'TaskEvalConsumer', ...createTaskEvalConsumer(sql) },
  { label: 'TaskImplConsumer', ...createTaskImplConsumer(sql) },
  // Schedulers and monitors
  { label: 'SyncScheduler', ...createSyncScheduler(
    sql,
    config.syncIntervalMinutes,
    config.syncThresholdMinutes,
    config.queuedTimeoutMinutes
  ) },
  // Backup evaluation scheduler - catches any tasks not immediately queued after sync
  { label: 'EvalScheduler', ...createEvalScheduler(
    sql,
    config.evalIntervalMinutes
  ) },
  { label: 'PipelineMonitor', ...createPipelineMonitor({
    pollIntervalMs: config.pipelinePollIntervalMs,
    timeoutMinutes: config.pipelineTimeoutMinutes,
    sql
  }) },
  { label: 'EvaluationRecovery', ...createEvaluationRecovery({
    sql,
    timeoutMinutes: config.stuckEvalTimeoutMinutes,
    checkIntervalMs: config.stuckEvalCheckIntervalMinutes * 60 * 1000
  }) }
]

async function main() {
  try {
    // Start all runners
    logger.info(`Starting ${runners.length} runners...`)
    let index = 1
    for (const runner of runners) {
      logger.info(`Starting runner ${index}/${runners.length}: ${runner.label}`)
      await runner.start()
      logger.info(`✓ ${runner.label} started`)
      index++
    }
    logger.info('✅ All runners started successfully')
  } catch (error) {
    logger.error('❌ Failed to start Micros-Task-Ops service:', error)
    if (error instanceof Error && error.stack) {
      logger.error('Stack trace:', error.stack)
    }
    process.exit(1)
  }
}

main()

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`)

  // Stop all runners
  for (const runner of runners) {
    await runner.stop()
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
