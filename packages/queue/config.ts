/**
 * Queue package configuration
 * RabbitMQ connection settings
 */

import { QUEUE_DEFAULTS } from '@adi-simple/config'

export const RABBITMQ_URL = process.env.RABBITMQ_URL || QUEUE_DEFAULTS.connectionUrl
