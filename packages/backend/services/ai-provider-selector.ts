import type { Sql } from 'postgres'
import type { AnthropicConfig } from '@types'
import { checkQuotaAvailable, type QuotaCheck } from '@db/user-quotas.ts'
import { getProjectAIProviderConfig } from '@db/projects.ts'
import { getDecryptedSecretValue } from './secrets'
import { getPlatformAnthropicConfig, type PlatformAnthropicConfig, FREE_QUOTA_DISABLED, FREE_QUOTA_DISABLED_MESSAGE } from '../config'
import { assertNever } from '@utils/assert-never'

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
  const quotaCheck = await checkQuotaAvailable(sql, userId, evaluationType)

  if (quotaCheck.at_hard_limit) {
    return await requireProjectAIProvider(sql, projectId, quotaCheck, evaluationType)
  }

  const platformConfig = getPlatformAnthropicConfig()

  if (!platformConfig) {
    return await requireProjectAIProvider(sql, projectId, quotaCheck, evaluationType)
  }

  // Use platform token
  const warning = quotaCheck.at_soft_limit
    ? FREE_QUOTA_DISABLED
      ? FREE_QUOTA_DISABLED_MESSAGE
      : `You are using ${quotaCheck.used}/${quotaCheck.hard_limit} free ${evaluationType} evaluations. ` +
        `Consider configuring your own Anthropic API key in project settings.`
    : undefined

  return {
    config: platformConfig,
    use_platform_token: true,
    quota_info: quotaCheck,
    warning,
  }
}

async function requireProjectAIProvider(
  sql: Sql,
  projectId: string,
  quotaCheck: QuotaCheck,
  evaluationType: 'simple' | 'advanced'
): Promise<AIProviderSelection> {
  const projectConfig = await getProjectAIProviderConfig(sql, projectId, 'anthropic') as AnthropicConfig | null

  if (!projectConfig) {
    const errorMessage = FREE_QUOTA_DISABLED
      ? FREE_QUOTA_DISABLED_MESSAGE
      : `Free ${evaluationType} evaluation quota exceeded (${quotaCheck.used}/${quotaCheck.hard_limit}). ` +
        `Please configure your own Anthropic API key in project settings to continue.`

    throw new QuotaExceededError(errorMessage, quotaCheck)
  }

  const resolvedConfig = await resolveAnthropicConfig(sql, projectConfig)

  return {
    config: resolvedConfig,
    use_platform_token: false,
  }
}

async function resolveAnthropicConfig(
  sql: Sql,
  config: AnthropicConfig
): Promise<ResolvedAnthropicConfig> {
  const apiKey = await getDecryptedSecretValue(sql, config.api_key_secret_id)

  switch (config.type) {
    case 'cloud':
      return {
        type: 'cloud',
        api_key: apiKey,
        model: config.model,
        max_tokens: config.max_tokens,
      }
    case 'self-hosted':
      return {
        type: 'self-hosted',
        api_key: apiKey,
        endpoint_url: config.endpoint_url,
        model: config.model,
        max_tokens: config.max_tokens,
        additional_headers: config.additional_headers,
      }
    default:
      return assertNever(config)
  }
}

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public quotaCheck: QuotaCheck,
  ) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

export async function checkProjectHasAnthropicProvider(
  sql: Sql,
  projectId: string
): Promise<boolean> {
  const config = await getProjectAIProviderConfig(sql, projectId, 'anthropic')
  return config !== null
}
