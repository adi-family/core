import { DEFAULT_HOSTS, DEFAULT_MODELS, getProxyConfig as getProxyConfigFromShared, DEFAULT_PORTS, AI_MODEL_DEFAULTS } from '@adi-simple/config'

// ============================================================================
// Server Configuration
// ============================================================================

export const SERVER_PORT = Number(process.env.SERVER_PORT || DEFAULT_PORTS.backend)
export const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${SERVER_PORT}`

// ============================================================================
// Authentication & Security
// ============================================================================

export const API_TOKEN = process.env.API_TOKEN || process.env.BACKEND_API_TOKEN || ''
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || ''

// ============================================================================
// CORS Configuration
// ============================================================================

export const SERVICE_FQDN_CLIENT = process.env.SERVICE_FQDN_CLIENT || ''

// Allowed CORS origins (comma-separated in env var)
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:4173', 'http://localhost:5173']

// ============================================================================
// API Base URLs
// ============================================================================

export const API_BASE_URL = process.env.API_BASE_URL || BACKEND_URL
export const GITLAB_RUNNER_API_URL = process.env.GITLAB_RUNNER_API_URL || ''

// ============================================================================
// GitLab Configuration
// ============================================================================

export const GITLAB_HOST = process.env.GITLAB_HOST || DEFAULT_HOSTS.gitlab
export const GITLAB_TOKEN = process.env.GITLAB_TOKEN || ''
export const GITLAB_USER = process.env.GITLAB_USER || ''
export const GITLAB_ROOT_OAUTH_HOST = process.env.GITLAB_ROOT_OAUTH_HOST || GITLAB_HOST

// ============================================================================
// GitLab OAuth Configuration
// ============================================================================

export const GITLAB_OAUTH_CLIENT_ID = process.env.GITLAB_OAUTH_CLIENT_ID || ''
export const GITLAB_OAUTH_REDIRECT_URI = process.env.GITLAB_OAUTH_REDIRECT_URI || ''
export const GITLAB_OAUTH_CLIENT_SECRET = process.env.GITLAB_OAUTH_CLIENT_SECRET || ''

// ============================================================================
// Jira OAuth Configuration
// ============================================================================

export const JIRA_OAUTH_CLIENT_ID = process.env.JIRA_OAUTH_CLIENT_ID || ''
export const JIRA_OAUTH_REDIRECT_URI = process.env.JIRA_OAUTH_REDIRECT_URI || ''
export const JIRA_OAUTH_CLIENT_SECRET = process.env.JIRA_OAUTH_CLIENT_SECRET || ''

// ============================================================================
// Webhook Configuration
// ============================================================================

export const GITLAB_WEBHOOK_SECRET = process.env.GITLAB_WEBHOOK_SECRET || ''
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ''

// ============================================================================
// Proxy Configuration
// ============================================================================

export const PROXY_HOST = process.env.PROXY_HOST
export const PROXY_USER = process.env.PROXY_USER
export const PROXY_PASS = process.env.PROXY_PASS

/**
 * Get proxy configuration if all required values are set
 * @deprecated Use getProxyConfig from @adi-simple/config instead
 */
export const getProxyConfig = getProxyConfigFromShared

// ============================================================================
// Feature Flags
// ============================================================================

export const MOCK_MODE = process.env.MOCK_MODE === 'true'
export const FREE_QUOTA_DISABLED = process.env.FREE_QUOTA_DISABLED === 'true'
export const FREE_QUOTA_DISABLED_MESSAGE = process.env.FREE_QUOTA_DISABLED_MESSAGE ||
  'Free quota is temporarily disabled. Please configure your own Anthropic API key in project settings.'

// ============================================================================
// Platform Anthropic Configuration
// ============================================================================

export interface PlatformAnthropicConfig {
  type: 'cloud'
  api_key: string
  model: string
  max_tokens: number
  temperature?: number
}

export function getPlatformAnthropicConfig(): PlatformAnthropicConfig | null {
  const apiKey = process.env.PLATFORM_ANTHROPIC_API_KEY

  if (!apiKey) {
    return null
  }

  return {
    type: 'cloud',
    api_key: apiKey,
    model: process.env.PLATFORM_ANTHROPIC_MODEL || DEFAULT_MODELS.anthropic,
    max_tokens: Number(process.env.PLATFORM_ANTHROPIC_MAX_TOKENS || AI_MODEL_DEFAULTS.maxTokensForPlatform),
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
