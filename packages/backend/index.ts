import { app } from './app'
import { createLogger } from '../utils/logger'

const logger = createLogger({ namespace: 'backend' })

if (!process.env.SERVER_PORT) {
  throw new Error('SERVER_PORT environment variable is required')
}

const port = Number(process.env.SERVER_PORT)

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  logger.info('Shutting down...')
  process.exit(0)
})

export default {
  port,
  fetch: app.fetch,
}

logger.info(`Server running on http://localhost:${port}`)
