/**
 * Task Sync Worker Service
 * Standalone service that consumes task-sync messages from RabbitMQ
 */

import { sql } from '@db/client'
import { createLogger } from '@utils/logger'
import { startTaskSyncConsumer } from '@queue/consumer'

const logger = createLogger({ namespace: 'worker-task-sync' })

async function main() {
  logger.info('Starting Task Sync Worker...')

  try {
    await startTaskSyncConsumer(sql)
    logger.info('✓ Task Sync Worker started successfully')
  } catch (error) {
    logger.error('Failed to start Task Sync Worker:', error)
    process.exit(1)
  }
}

main()
