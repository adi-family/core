/**
 * Worker Dispatcher Microservice
 * Main entry point for consuming worker responses
 */

import { ResponseConsumer } from './response-consumer'
import { createLogger } from '@utils/logger'
import { setupGracefulShutdown } from '@backend/utils/graceful-shutdown'

const logger = createLogger({ namespace: 'worker-dispatcher' })

async function main() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost'

  logger.info('Starting Worker Dispatcher Microservice...')
  logger.info(`RabbitMQ URL: ${rabbitmqUrl}`)

  const consumer = new ResponseConsumer(rabbitmqUrl)

  try {
    await consumer.connect()
    await consumer.startConsuming()

    logger.info('Worker Dispatcher is running and consuming responses')

    // Setup graceful shutdown
    setupGracefulShutdown({
      logger,
      serviceName: 'Worker Dispatcher',
      cleanup: async () => {
        await consumer.close()
      }
    })

  } catch (error) {
    logger.error('Failed to start Worker Dispatcher:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  logger.error('Unhandled error in main:', error)
  process.exit(1)
})
