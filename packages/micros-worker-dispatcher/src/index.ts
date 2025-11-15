/**
 * Worker Dispatcher Microservice
 * Main entry point for consuming worker responses
 */

import { ResponseConsumer } from './response-consumer'
import { createLogger } from '@utils/logger'

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

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`)
      await consumer.close()
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

  } catch (error) {
    logger.error('Failed to start Worker Dispatcher:', error)
    process.exit(1)
  }
}

main().catch((error) => {
  logger.error('Unhandled error in main:', error)
  process.exit(1)
})
