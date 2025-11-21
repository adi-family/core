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
 * List of supported deployment types for AI providers
 */
export const deploymentTypes: ProviderType[] = ['cloud', 'azure', 'vertex', 'self-hosted']

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
 * AI Model configuration defaults
 */
export const AI_MODEL_DEFAULTS = {
  maxTokensForEvaluation: 4000,
  maxTokensForPlatform: 8000,
  maxTokensForValidation: 10,
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
 * Priority Quadrants
 * Used for task prioritization based on impact and effort
 */
export const PRIORITY_QUADRANTS = ['quick_win', 'major_project', 'fill_in', 'thankless_task'] as const
export type PriorityQuadrant = typeof PRIORITY_QUADRANTS[number]

export const PRIORITY_QUADRANT_LABELS: Record<PriorityQuadrant, string> = {
  quick_win: 'Quick Win',
  major_project: 'Major Project',
  fill_in: 'Fill In',
  thankless_task: 'Thankless Task',
} as const

/**
 * Task Effort Levels
 * Standardized effort estimates with their multipliers
 */
export const EFFORT_LEVELS = ['xs', 's', 'm', 'l', 'xl'] as const
export type EffortLevel = typeof EFFORT_LEVELS[number]

export const EFFORT_MULTIPLIERS: Record<EffortLevel, number> = {
  xs: 0.3,
  s: 0.5,
  m: 1.0,
  l: 1.5,
  xl: 2.0,
} as const

/**
 * Risk and Impact Levels
 */
export const RISK_LEVELS = ['low', 'medium', 'high'] as const
export type RiskLevel = typeof RISK_LEVELS[number]

export const IMPACT_LEVELS = ['low', 'medium', 'high'] as const
export type ImpactLevel = typeof IMPACT_LEVELS[number]

/**
 * Task Source Types
 * Different external systems that can provide tasks
 */
export const TASK_SOURCE_TYPES = ['gitlab_issues', 'github_issues', 'jira'] as const
export type TaskSourceType = typeof TASK_SOURCE_TYPES[number]

export const TASK_SOURCE_TYPE_LABELS: Record<TaskSourceType, string> = {
  gitlab_issues: 'GitLab Issues',
  github_issues: 'GitHub Issues',
  jira: 'Jira',
} as const

/**
 * File Space Types
 * Different version control systems supported
 */
export const FILE_SPACE_TYPES = ['gitlab', 'github'] as const
export type FileSpaceType = typeof FILE_SPACE_TYPES[number]

export const FILE_SPACE_TYPE_LABELS: Record<FileSpaceType, string> = {
  gitlab: 'GitLab',
  github: 'GitHub',
} as const

/**
 * Token Types
 * Different authentication token types
 */
export const TOKEN_TYPES = ['api', 'oauth', 'pat'] as const
export type TokenType = typeof TOKEN_TYPES[number]

/**
 * Task Types
 * Categories of work that tasks can represent
 */
export const TASK_TYPES = ['bug_fix', 'feature', 'refactor', 'docs', 'test', 'config', 'other'] as const
export type TaskType = typeof TASK_TYPES[number]

/**
 * Task Creation Sources
 * Where tasks can be created from
 */
export const CREATED_VIA = ['ui', 'api'] as const
export type CreatedVia = typeof CREATED_VIA[number]

/**
 * User Roles
 */
export const PROJECT_ROLES = ['owner', 'admin', 'developer', 'viewer'] as const
export const SECRET_ROLES = ['read', 'write', 'use'] as const
export const ALL_ROLES = [...PROJECT_ROLES, ...SECRET_ROLES] as const
export type ProjectRole = typeof PROJECT_ROLES[number]
export type SecretRole = typeof SECRET_ROLES[number]
export type Role = typeof ALL_ROLES[number]

/**
 * GitLab Required Scopes
 * OAuth scopes needed for different GitLab integrations
 */
export const GITLAB_SCOPES = {
  fileSpace: ['api', 'write_repository'] as const,
  taskSource: ['api'] as const,
  executor: ['api'] as const,
} as const

/**
 * Default Branch Names
 * Common branch names to try when looking for default branches
 */
export const DEFAULT_BRANCHES = ['dev', 'develop', 'development', 'main', 'master'] as const
export type DefaultBranch = typeof DEFAULT_BRANCHES[number]

/**
 * Evaluation Verdicts
 * Possible outcomes from task evaluation
 */
export const EVALUATION_VERDICTS = ['ready', 'needs_clarification'] as const
export type EvaluationVerdict = typeof EVALUATION_VERDICTS[number]

/**
 * Required Environment Variables
 * Environment variables that must be present in worker execution
 */
export const REQUIRED_ENV_VARS = ['SESSION_ID', 'API_BASE_URL', 'API_TOKEN'] as const

/**
 * Allowed Claude Tools
 * Tools that Claude is permitted to use in worker execution
 */
export const ALLOWED_CLAUDE_TOOLS = ['Read', 'Glob', 'Grep'] as const

/**
 * Type guard and helper functions
 */

export function isProvider(value: string): value is Provider {
  return supportedProviders.includes(value as Provider)
}

export function isDeploymentType(value: string): value is ProviderType {
  return deploymentTypes.includes(value as ProviderType)
}

export function isTaskSyncStatus(value: string): value is TaskSyncStatus {
  return TASK_STATUS.sync.includes(value as TaskSyncStatus)
}

export function isTaskEvaluationStatus(value: string): value is TaskEvaluationStatus {
  return TASK_STATUS.evaluation.includes(value as TaskEvaluationStatus)
}

export function isTaskImplementationStatus(value: string): value is TaskImplementationStatus {
  return TASK_STATUS.implementation.includes(value as TaskImplementationStatus)
}

export function isPipelineExecutionStatus(value: string): value is PipelineExecutionStatus {
  return TASK_STATUS.pipeline.includes(value as PipelineExecutionStatus)
}

export function isRemoteTaskStatus(value: string): value is RemoteTaskStatus {
  return TASK_STATUS.remote.includes(value as RemoteTaskStatus)
}

export function isPriorityQuadrant(value: string): value is PriorityQuadrant {
  return PRIORITY_QUADRANTS.includes(value as PriorityQuadrant)
}

export function isEffortLevel(value: string): value is EffortLevel {
  return EFFORT_LEVELS.includes(value as EffortLevel)
}

export function isRiskLevel(value: string): value is RiskLevel {
  return RISK_LEVELS.includes(value as RiskLevel)
}

export function isImpactLevel(value: string): value is ImpactLevel {
  return IMPACT_LEVELS.includes(value as ImpactLevel)
}

export function isTaskSourceType(value: string): value is TaskSourceType {
  return TASK_SOURCE_TYPES.includes(value as TaskSourceType)
}

export function isFileSpaceType(value: string): value is FileSpaceType {
  return FILE_SPACE_TYPES.includes(value as FileSpaceType)
}

export function isTokenType(value: string): value is TokenType {
  return TOKEN_TYPES.includes(value as TokenType)
}

export function isTaskType(value: string): value is TaskType {
  return TASK_TYPES.includes(value as TaskType)
}

export function isCreatedVia(value: string): value is CreatedVia {
  return CREATED_VIA.includes(value as CreatedVia)
}

export function isProjectRole(value: string): value is ProjectRole {
  return PROJECT_ROLES.includes(value as ProjectRole)
}

export function isSecretRole(value: string): value is SecretRole {
  return SECRET_ROLES.includes(value as SecretRole)
}

export function isRole(value: string): value is Role {
  return ALL_ROLES.includes(value as Role)
}

export function isEvaluationVerdict(value: string): value is EvaluationVerdict {
  return EVALUATION_VERDICTS.includes(value as EvaluationVerdict)
}

export function isDefaultBranch(value: string): value is DefaultBranch {
  return DEFAULT_BRANCHES.includes(value as DefaultBranch)
}
