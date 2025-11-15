import amqp from 'amqplib'
import { createLogger } from '@utils/logger'
import {
  TASK_SYNC_CONFIG,
  TASK_SYNC_DLQ_CONFIG,
  TASK_SYNC_DLX,
  TASK_EVAL_CONFIG,
  TASK_EVAL_DLQ_CONFIG,
  TASK_EVAL_DLX,
  TASK_IMPL_CONFIG,
  TASK_IMPL_DLQ_CONFIG,
  TASK_IMPL_DLX,
  WORKER_TASKS_CONFIG,
  WORKER_TASKS_DLQ_CONFIG,
  WORKER_TASKS_DLX,
  WORKER_RESPONSES_CONFIG
} from './queues'
import { singleton } from "@utils/singleton";

const logger = createLogger({ namespace: 'rabbitmq' });

export const connection = singleton<amqp.ChannelModel>(async (connCtx) => {
  const rabbitmqUrl = process.env.RABBITMQ_URL
  if (!rabbitmqUrl) {
    throw new Error('RABBITMQ_URL environment variable is required')
  }

  const conn = await amqp.connect(rabbitmqUrl);
  logger.info('Connected to RabbitMQ')

  conn.on('error', (err) => {
    logger.error('RabbitMQ connection error:', err)
    connCtx.reset();
    channel.reset();
  });

  conn.on('close', () => {
    logger.warn('RabbitMQ connection closed')
    connCtx.reset();
    channel.reset();
  })

  return conn;
});

export const channel = singleton<amqp.Channel>(async (channelCtx) => {
  const connVal = await connection.value;
  const ch = await connVal.createChannel();

  ch.on('error', (err) => {
    logger.error('RabbitMQ channel error:', err)
    channelCtx.reset()
  })

  ch.on('close', () => {
    logger.warn('RabbitMQ channel closed')
    channelCtx.reset()
  })

  await setupQueues(ch);

  return ch;
});

async function setupQueues(ch: amqp.Channel): Promise<void> {
  // Task Sync Queues
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

  // Task Evaluation Queues
  // Create dead letter exchange
  await ch.assertExchange(TASK_EVAL_DLX, 'direct', { durable: true })

  // Create dead letter queue
  await ch.assertQueue(TASK_EVAL_DLQ_CONFIG.name, {
    durable: TASK_EVAL_DLQ_CONFIG.durable
  })

  // Bind DLQ to DLX
  await ch.bindQueue(TASK_EVAL_DLQ_CONFIG.name, TASK_EVAL_DLX, TASK_EVAL_CONFIG.name)

  // Create main queue with DLX
  await ch.assertQueue(TASK_EVAL_CONFIG.name, {
    durable: TASK_EVAL_CONFIG.durable,
    deadLetterExchange: TASK_EVAL_CONFIG.deadLetterExchange,
    arguments: {
      'x-message-ttl': TASK_EVAL_CONFIG.messageTtl
    }
  })

  // Task Implementation Queues
  // Create dead letter exchange
  await ch.assertExchange(TASK_IMPL_DLX, 'direct', { durable: true })

  // Create dead letter queue
  await ch.assertQueue(TASK_IMPL_DLQ_CONFIG.name, {
    durable: TASK_IMPL_DLQ_CONFIG.durable
  })

  // Bind DLQ to DLX
  await ch.bindQueue(TASK_IMPL_DLQ_CONFIG.name, TASK_IMPL_DLX, TASK_IMPL_CONFIG.name)

  // Create main queue with DLX
  await ch.assertQueue(TASK_IMPL_CONFIG.name, {
    durable: TASK_IMPL_CONFIG.durable,
    deadLetterExchange: TASK_IMPL_CONFIG.deadLetterExchange,
    arguments: {
      'x-message-ttl': TASK_IMPL_CONFIG.messageTtl
    }
  })

  // Worker Tasks Queues
  // Create dead letter exchange
  await ch.assertExchange(WORKER_TASKS_DLX, 'direct', { durable: true })

  // Create dead letter queue
  await ch.assertQueue(WORKER_TASKS_DLQ_CONFIG.name, {
    durable: WORKER_TASKS_DLQ_CONFIG.durable
  })

  // Bind DLQ to DLX
  await ch.bindQueue(WORKER_TASKS_DLQ_CONFIG.name, WORKER_TASKS_DLX, WORKER_TASKS_CONFIG.name)

  // Create main queue with DLX
  await ch.assertQueue(WORKER_TASKS_CONFIG.name, {
    durable: WORKER_TASKS_CONFIG.durable,
    deadLetterExchange: WORKER_TASKS_CONFIG.deadLetterExchange,
    arguments: {
      'x-message-ttl': WORKER_TASKS_CONFIG.messageTtl
    }
  })

  // Worker Responses Queue (no DLX needed)
  await ch.assertQueue(WORKER_RESPONSES_CONFIG.name, {
    durable: WORKER_RESPONSES_CONFIG.durable,
    arguments: {
      'x-message-ttl': WORKER_RESPONSES_CONFIG.messageTtl
    }
  })

  logger.info('RabbitMQ queues and exchanges configured')
}
