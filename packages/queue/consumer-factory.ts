/**
 * Generic Queue Consumer Factory
 * Creates RabbitMQ consumers with standardized error handling and retry logic
 */

import type { Sql } from 'postgres'
import type { ConsumeMessage } from 'amqplib'
import type { QueueConfig } from './types'
import { createLogger } from '@utils/logger'
import { channel } from './connection'

const logger = createLogger({ namespace: 'queue-consumer-factory' })

export interface Runner {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

export interface ConsumerConfig<_T = any> {
  queueName: string
  queueConfig: QueueConfig
  prefetchCount: number
  consumerLabel: string
  processMessage: (sql: Sql, msg: ConsumeMessage) => Promise<void>
}

/**
 * Create a generic queue consumer with retry logic and error handling
 * @param sql Database connection
 * @param config Consumer configuration
 * @returns Runner with start/stop methods
 */
export function createQueueConsumer<T = any>(
  sql: Sql,
  config: ConsumerConfig<T>
): Runner {
  let consumerTag: string | null = null

  return {
    start: async () => {
      if (consumerTag) {
        logger.warn(`${config.consumerLabel} consumer already running`)
        return
      }

      try {
        const ch = await channel.value

        await ch.prefetch(config.prefetchCount)

        logger.info(`Starting consumer for queue: ${config.queueName}`)

        const result = await ch.consume(
          config.queueName,
          async (msg: ConsumeMessage | null) => {
            if (!msg) {
              return
            }

            try {
              await config.processMessage(sql, msg)
              ch.ack(msg)
            } catch (error) {
              logger.error(`Failed to process ${config.consumerLabel} message:`, error)

              const attempt = (msg.properties.headers?.['x-attempt'] || 0) + 1
              const maxRetries = config.queueConfig.maxRetries || 3

              if (attempt >= maxRetries) {
                logger.error(`Message exceeded max retries (${maxRetries}), sending to DLQ`)
                ch.nack(msg, false, false)
              } else {
                logger.warn(`Retrying message (attempt ${attempt}/${maxRetries})`)
                ch.nack(msg, false, true)
              }
            }
          },
          {
            noAck: false,
            consumerTag: `${config.consumerLabel}-${process.pid}-${Date.now()}`
          }
        )

        consumerTag = result.consumerTag

        logger.info(`${config.consumerLabel} consumer started successfully`)
      } catch (error) {
        logger.error(`Failed to start ${config.consumerLabel} consumer:`, error)
        throw error
      }
    },

    stop: async () => {
      if (consumerTag) {
        try {
          const ch = await channel.value
          await ch.cancel(consumerTag)
          consumerTag = null
          logger.info(`${config.consumerLabel} consumer stopped`)
        } catch (error) {
          logger.error(`Failed to stop ${config.consumerLabel} consumer:`, error)
        }
      }
    }
  }
}
