/**
 * Queue package configuration
 * RabbitMQ connection settings
 */

export const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672'
