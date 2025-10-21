import amqp from 'amqplib'
import { createLogger } from '@utils/logger'
import { TASK_SYNC_CONFIG, TASK_SYNC_DLQ_CONFIG, TASK_SYNC_DLX } from './queues'

const logger = createLogger({ namespace: 'rabbitmq' })

let connection: amqp.Connection | null = null
let channel: amqp.Channel | null = null

export async function getRabbitMQConnection(): Promise<amqp.Connection> {
  if (connection) {
    return connection
  }

  const rabbitmqUrl = process.env.RABBITMQ_URL
  if (!rabbitmqUrl) {
    throw new Error('RABBITMQ_URL environment variable is required')
  }

  try {
    connection = await amqp.connect(rabbitmqUrl)
    logger.info('Connected to RabbitMQ')

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err)
      connection = null
      channel = null
    })

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed')
      connection = null
      channel = null
    })

    return connection
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ:', error)
    throw error
  }
}

export async function getRabbitMQChannel(): Promise<amqp.Channel> {
  if (channel) {
    return channel
  }

  const conn = await getRabbitMQConnection()
  channel = await conn.createChannel()

  logger.info('Created RabbitMQ channel')

  channel.on('error', (err) => {
    logger.error('RabbitMQ channel error:', err)
    channel = null
  })

  channel.on('close', () => {
    logger.warn('RabbitMQ channel closed')
    channel = null
  })

  await setupQueues(channel)

  return channel
}

async function setupQueues(ch: amqp.Channel): Promise<void> {
  // Create dead letter exchange
  await ch.assertExchange(TASK_SYNC_DLX, 'direct', { durable: true })

  // Create dead letter queue
  await ch.assertQueue(TASK_SYNC_DLQ_CONFIG.name, {
    durable: TASK_SYNC_DLQ_CONFIG.durable
  })

  // Bind DLQ to DLX
  await ch.bindQueue(TASK_SYNC_DLQ_CONFIG.name, TASK_SYNC_DLX, TASK_SYNC_CONFIG.name)

  // Create main queue with DLX
  await ch.assertQueue(TASK_SYNC_CONFIG.name, {
    durable: TASK_SYNC_CONFIG.durable,
    deadLetterExchange: TASK_SYNC_CONFIG.deadLetterExchange,
    arguments: {
      'x-message-ttl': TASK_SYNC_CONFIG.messageTtl
    }
  })

  logger.info('RabbitMQ queues and exchanges configured')
}

export async function closeRabbitMQConnection(): Promise<void> {
  try {
    if (channel) {
      await channel.close()
      channel = null
    }
    if (connection) {
      await connection.close()
      connection = null
    }
    logger.info('RabbitMQ connection closed')
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error)
  }
}
