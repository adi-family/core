/**
 * AI Provider type definition
 * Represents the supported AI providers in the system
 */
export type Provider = 'anthropic' | 'openai' | 'google'

/**
 * AI Provider Type definition
 * Represents the different deployment types for AI providers
 */
export type ProviderType = 'cloud' | 'azure' | 'vertex' | 'self-hosted'

/**
 * List of supported AI providers
 * This array contains all the providers that are currently supported by the system
 */
export const supportedProviders: Provider[] = ['anthropic', 'openai', 'google']

/**
 * Task Status Enums
 * Centralized status definitions for all task types across the system
 */
export const TASK_STATUS = {
  sync: ['pending', 'queued', 'syncing', 'completed', 'failed'] as const,
  evaluation: ['pending', 'queued', 'evaluating', 'completed', 'failed'] as const,
  implementation: ['pending', 'queued', 'implementing', 'completed', 'failed'] as const,
  pipeline: ['pending', 'running', 'success', 'failed', 'canceled'] as const,
  remote: ['opened', 'closed'] as const,
} as const

// Type exports for convenience
export type TaskSyncStatus = typeof TASK_STATUS.sync[number]
export type TaskEvaluationStatus = typeof TASK_STATUS.evaluation[number]
export type TaskImplementationStatus = typeof TASK_STATUS.implementation[number]
export type PipelineExecutionStatus = typeof TASK_STATUS.pipeline[number]
export type RemoteTaskStatus = typeof TASK_STATUS.remote[number]

/**
 * Default third-party service hosts
 */
export const DEFAULT_HOSTS = {
  gitlab: 'https://gitlab.com',
  github: 'https://github.com',
  jira: 'https://jira.atlassian.net',
} as const

/**
 * Default AI model names for each provider
 */
export const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4',
  google: 'gemini-pro',
} as const

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
 * AI Model configuration defaults
 */
export const AI_MODEL_DEFAULTS = {
  maxTokensForEvaluation: 4000,
  maxTokensForPlatform: 8000,
  maxTokensForValidation: 10,
} as const

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
 * Default ports for services
 */
export const DEFAULT_PORTS = {
  backend: 3000,
} as const

/**
 * Default service URLs
 */
export const DEFAULT_URLS = {
  localhost: `http://localhost:${DEFAULT_PORTS.backend}`,
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
