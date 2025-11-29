/**
 * Shared configuration constants safe for both client and server
 * This file should NEVER contain process.env references or Node.js-specific code
 */

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
export enum EvaluationStatus {
  Pending = 'pending',
  Queued = 'queued',
  Evaluating = 'evaluating',
  Completed = 'completed',
  Failed = 'failed'
}

export enum ImplementationStatus {
  Pending = 'pending',
  Queued = 'queued',
  Implementing = 'implementing',
  Completed = 'completed',
  Failed = 'failed'
}

export enum PipelineStatus {
  Pending = 'pending',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Canceled = 'canceled'
}

export enum RemoteStatus {
  Opened = 'opened',
  Closed = 'closed'
}

export enum SyncStatus {
  Pending = 'pending',
  Queued = 'queued',
  Syncing = 'syncing',
  Completed = 'completed',
  Failed = 'failed'
}

// Legacy array format (for backwards compatibility)
export const TASK_STATUS = {
  sync: ['pending', 'queued', 'syncing', 'completed', 'failed'] as const,
  evaluation: ['pending', 'queued', 'evaluating', 'completed', 'failed'] as const,
  implementation: ['pending', 'queued', 'implementing', 'completed', 'failed'] as const,
  pipeline: ['pending', 'running', 'success', 'failed', 'canceled'] as const,
  remote: ['opened', 'closed'] as const,
} as const

// Type exports for convenience
export type TaskSyncStatus = SyncStatus
export type TaskEvaluationStatus = EvaluationStatus
export type TaskImplementationStatus = ImplementationStatus
export type PipelineExecutionStatus = PipelineStatus
export type RemoteTaskStatus = RemoteStatus

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
 * AI Model configuration defaults
 */
export const AI_MODEL_DEFAULTS = {
  maxTokensForEvaluation: 4000,
  maxTokensForPlatform: 8000,
  maxTokensForValidation: 10,
} as const

/**
 * API version constants for AI providers
 */
export const API_VERSIONS = {
  anthropic: '2023-06-01',
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
