/**
 * Task Evaluation Worker Service
 * Standalone service that consumes task-eval messages from RabbitMQ
 */

import { sql } from '@db/client'
import { createLogger } from '@utils/logger'
import { startTaskEvalConsumer } from '@queue/consumer'

const logger = createLogger({ namespace: 'worker-task-eval' })

async function main() {
  logger.info('Starting Task Evaluation Worker...')

  try {
    await startTaskEvalConsumer(sql)
    logger.info('✓ Task Evaluation Worker started successfully')
  } catch (error) {
    logger.error('Failed to start Task Evaluation Worker:', error)
    process.exit(1)
  }
}

main()
