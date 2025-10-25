/**
 * Task Implementation Worker Service
 * Standalone service that consumes task-impl messages from RabbitMQ
 */

import { sql } from '@db/client'
import { createLogger } from '@utils/logger'
import { startTaskImplConsumer } from '@queue/consumer'

const logger = createLogger({ namespace: 'worker-task-impl' })

async function main() {
  logger.info('Starting Task Implementation Worker...')

  try {
    await startTaskImplConsumer(sql)
    logger.info('✓ Task Implementation Worker started successfully')
  } catch (error) {
    logger.error('Failed to start Task Implementation Worker:', error)
    process.exit(1)
  }
}

main()
