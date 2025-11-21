/**
 * Generic graceful shutdown handler for microservices
 * Handles SIGTERM and SIGINT signals with custom cleanup logic
 */

import type { Logger } from '@utils/logger'

export interface ShutdownConfig {
  logger: Logger
  serviceName: string
  cleanup: () => Promise<void>
}

/**
 * Setup graceful shutdown handlers for a service
 * @param config Configuration including logger, service name, and cleanup callback
 */
export function setupGracefulShutdown(config: ShutdownConfig): void {
  const { logger, serviceName, cleanup } = config

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down ${serviceName} gracefully...`)

    try {
      await cleanup()
      logger.info(`✅ ${serviceName} stopped successfully`)
      process.exit(0)
    } catch (error) {
      logger.error(`Error during ${serviceName} shutdown:`, error)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}
