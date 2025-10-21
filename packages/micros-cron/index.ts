/**
 * Micros-Cron Service - Standalone Entry Point
 * Independent microservice for periodic task source synchronization
 */

import { sql } from '@db/client'
import { createLogger } from '@utils/logger'
import { startCronScheduler, stopCronScheduler } from './service'

const logger = createLogger({ namespace: 'micros-cron-main' })

// Validate environment variables
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required')
  process.exit(1)
}

// Get configuration from environment
const intervalMinutes = process.env.CRON_INTERVAL_MINUTES
  ? Number(process.env.CRON_INTERVAL_MINUTES)
  : 15

const syncThresholdMinutes = process.env.SYNC_THRESHOLD_MINUTES
  ? Number(process.env.SYNC_THRESHOLD_MINUTES)
  : 30

const queuedTimeoutMinutes = process.env.QUEUED_TIMEOUT_MINUTES
  ? Number(process.env.QUEUED_TIMEOUT_MINUTES)
  : 120

logger.info('Starting Micros-Cron service...')
logger.info(`Configuration:`)
logger.info(`  - Check interval: ${intervalMinutes} minutes`)
logger.info(`  - Sync threshold: ${syncThresholdMinutes} minutes`)
logger.info(`  - Stuck task timeout: ${queuedTimeoutMinutes} minutes`)

// Start the cron scheduler
let timer: NodeJS.Timeout | null = null
try {
  timer = startCronScheduler(sql, intervalMinutes, syncThresholdMinutes, queuedTimeoutMinutes)
  logger.info('Micros-Cron service started successfully')
} catch (error) {
  logger.error('Failed to start Micros-Cron service:', error)
  process.exit(1)
}

// Graceful shutdown handlers
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`)
  if (timer) {
    stopCronScheduler(timer)
  }
  sql.end().then(() => {
    logger.info('Database connection closed')
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
