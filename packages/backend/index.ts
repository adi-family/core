import { app } from './app'
import { createLogger } from '../utils/logger'

const logger = createLogger({ namespace: 'backend' })

if (!process.env.SERVER_PORT) {
  throw new Error('SERVER_PORT environment variable is required')
}

const port = Number(process.env.SERVER_PORT)

// Pipeline monitor moved to micros-task-ops service
// Backend is now a pure stateless API server

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down...')
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // 2 minutes timeout for long-running operations like file uploads
}

logger.info(`Server running on http://localhost:${port}`)
