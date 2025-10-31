import type { Sql } from 'postgres'
import type { AnthropicConfig } from '@types'
import { checkQuotaAvailable, type QuotaCheck } from '@db/user-quotas.ts'
import { getProjectAIProviderConfig } from '@db/projects.ts'
import { getDecryptedSecretValue } from './secrets'
import { getPlatformAnthropicConfig, type PlatformAnthropicConfig } from '../config'

/**
 * Result of AI provider selection for evaluation
 */
export interface AIProviderSelection {
  config: PlatformAnthropicConfig | ResolvedAnthropicConfig
  use_platform_token: boolean
  quota_info?: QuotaCheck
  warning?: string
}

export interface ResolvedAnthropicConfig {
  type: 'cloud' | 'self-hosted'
  api_key: string
  endpoint_url?: string
  model?: string
  max_tokens?: number
  additional_headers?: Record<string, string>
}

/**
 * Select AI provider configuration for evaluation
 * Chooses between platform token (free quota) or project token (quota exceeded)
 */
export async function selectAIProviderForEvaluation(
  sql: Sql,
  userId: string,
  projectId: string,
  evaluationType: 'simple' | 'advanced'
): Promise<AIProviderSelection> {
  // Check user's quota
  const quotaCheck = await checkQuotaAvailable(sql, userId, evaluationType)

  // If at hard limit, require project config
  if (quotaCheck.at_hard_limit) {
    return await requireProjectAIProvider(sql, projectId, quotaCheck, evaluationType)
  }

  // User has quota remaining - try to use platform token
  const platformConfig = getPlatformAnthropicConfig()

  if (!platformConfig) {
    // Platform token not configured - require project config
    return await requireProjectAIProvider(sql, projectId, quotaCheck, evaluationType)
  }

  // Use platform token
  const warning = quotaCheck.at_soft_limit
    ? `You are using ${quotaCheck.used}/${quotaCheck.hard_limit} free ${evaluationType} evaluations. ` +
      `Consider configuring your own Anthropic API key in project settings.`
    : undefined

  return {
    config: platformConfig,
    use_platform_token: true,
    quota_info: quotaCheck,
    warning,
  }
}

/**
 * Require project to have its own AI provider configured
 * Throws error if not configured
 */
async function requireProjectAIProvider(
  sql: Sql,
  projectId: string,
  quotaCheck: QuotaCheck,
  evaluationType: 'simple' | 'advanced'
): Promise<AIProviderSelection> {
  // Get project's Anthropic config
  const projectConfig = await getProjectAIProviderConfig(sql, projectId, 'anthropic') as AnthropicConfig | null

  if (!projectConfig) {
    throw new QuotaExceededError(
      `Free ${evaluationType} evaluation quota exceeded (${quotaCheck.used}/${quotaCheck.hard_limit}). ` +
      `Please configure your own Anthropic API key in project settings to continue.`,
      quotaCheck
    )
  }

  // Decrypt API key from secret
  const resolvedConfig = await resolveAnthropicConfig(sql, projectConfig)

  return {
    config: resolvedConfig,
    use_platform_token: false,
  }
}

/**
 * Resolve Anthropic config by decrypting the API key from secrets
 */
async function resolveAnthropicConfig(
  sql: Sql,
  config: AnthropicConfig
): Promise<ResolvedAnthropicConfig> {
  const apiKey = await getDecryptedSecretValue(sql, config.api_key_secret_id)

  if (config.type === 'cloud') {
    return {
      type: 'cloud',
      api_key: apiKey,
      model: config.model,
      max_tokens: config.max_tokens,
    }
  } else {
    return {
      type: 'self-hosted',
      api_key: apiKey,
      endpoint_url: config.endpoint_url,
      model: config.model,
      max_tokens: config.max_tokens,
      additional_headers: config.additional_headers,
    }
  }
}

/**
 * Custom error for quota exceeded scenarios
 */
export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public quotaCheck: QuotaCheck
  ) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

/**
 * Check if project has its own AI provider configured
 */
export async function checkProjectHasAnthropicProvider(
  sql: Sql,
  projectId: string
): Promise<boolean> {
  const config = await getProjectAIProviderConfig(sql, projectId, 'anthropic')
  return config !== null
}
