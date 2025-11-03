/**
 * Server-only configuration
 * This file contains Node.js-specific configuration and process.env references
 * DO NOT import this file in client/browser code
 */

/**
 * Proxy configuration interface
 */
export interface ProxyConfig {
  host: string
  user: string
  pass: string
}

/**
 * Get proxy configuration from environment variables
 * Returns null if any required environment variable is missing
 * Note: This function is only available in Node.js environments
 */
export function getProxyConfig(): ProxyConfig | null {
  if (!process.env.PROXY_HOST || !process.env.PROXY_USER || !process.env.PROXY_PASS) {
    return null
  }
  return {
    host: process.env.PROXY_HOST,
    user: process.env.PROXY_USER,
    pass: process.env.PROXY_PASS,
  }
}

/**
 * Pipeline timeout configuration
 */
export const PIPELINE_TIMEOUTS = {
  executorTimeoutMs: 10 * 60 * 1000, // 10 minutes
  monitorTimeoutMinutes: 30,
  monitorPollIntervalMs: 10 * 60 * 1000, // 10 minutes
} as const

/**
 * Evaluation recovery configuration
 */
export const EVALUATION_RECOVERY = {
  stuckEvaluationTimeoutMinutes: 60,
  checkIntervalMinutes: 15,
} as const

/**
 * Task operations default intervals and timeouts
 */
export const TASK_OPS_DEFAULTS = {
  syncIntervalMinutes: 15,
  syncThresholdMinutes: 30,
  queuedTimeoutMinutes: 120,
  evalIntervalMinutes: 1,
  stuckEvalCheckIntervalMinutes: 15,
  stuckEvalTimeoutMinutes: 60,
} as const

/**
 * Retry logic defaults for service-to-service calls
 */
export const RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
} as const

/**
 * Feature flags
 */
export const FEATURE_FLAGS = {
  mockMode: process.env.MOCK_MODE === 'true',
} as const

/**
 * Queue configuration defaults
 */
export const QUEUE_DEFAULTS = {
  messageRetention: {
    sync: 3600000, // 1 hour
    evaluation: 3600000, // 1 hour
    implementation: 7200000, // 2 hours
  },
  maxRetries: 3,
  connectionUrl: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
} as const

/**
 * CloudFlare tunnel configuration
 */
export const TUNNEL_CONFIG = {
  url: 'https://adi-local-tunel.the-ihor.com',
  maxRestartDelayMs: 30000,
  initialRestartDelayMs: 1000,
  maxConsecutiveFailures: 10,
} as const
