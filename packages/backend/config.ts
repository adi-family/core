/**
 * Platform configuration for free tier evaluations
 * Uses platform's Anthropic API key for users who haven't exceeded their quota
 */

/**
 * Platform Anthropic configuration (uses direct API key, not secret reference)
 */
export interface PlatformAnthropicConfig {
  type: 'cloud'
  api_key: string
  model: string
  max_tokens: number
  temperature?: number
}

/**
 * Get platform Anthropic configuration for free tier evaluations
 * Returns null if PLATFORM_ANTHROPIC_API_KEY is not set
 */
export function getPlatformAnthropicConfig(): PlatformAnthropicConfig | null {
  const apiKey = process.env.PLATFORM_ANTHROPIC_API_KEY

  if (!apiKey) {
    return null
  }

  return {
    type: 'cloud',
    api_key: apiKey,
    model: process.env.PLATFORM_ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    max_tokens: Number(process.env.PLATFORM_ANTHROPIC_MAX_TOKENS || '8000'),
    temperature: process.env.PLATFORM_ANTHROPIC_TEMPERATURE
      ? Number(process.env.PLATFORM_ANTHROPIC_TEMPERATURE)
      : undefined,
  }
}

/**
 * Check if platform AI provider is configured
 */
export function hasPlatformAnthropicConfig(): boolean {
  return !!process.env.PLATFORM_ANTHROPIC_API_KEY
}
