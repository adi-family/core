import { app } from './app'
import { createLogger } from '../utils/logger'
import { startScheduler, stopScheduler } from './services/scheduler'
import { sql } from '../db/client'

const logger = createLogger({ namespace: 'backend' })

if (!process.env.SERVER_PORT) {
  throw new Error('SERVER_PORT environment variable is required')
}

const port = Number(process.env.SERVER_PORT)

// Start scheduler if enabled
startScheduler(sql, {
  intervalMs: process.env.SCHEDULER_INTERVAL_MS
    ? Number(process.env.SCHEDULER_INTERVAL_MS)
    : 600000, // 10 minutes default
  runner: process.env.DEFAULT_RUNNER || 'claude',
  enabled: process.env.ENABLE_SCHEDULER === 'true'
})

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down...')
  stopScheduler()
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info('Shutting down...')
  stopScheduler()
  process.exit(0)
})

export default {
  port,
  fetch: app.fetch,
}

logger.info(`Server running on http://localhost:${port}`)
