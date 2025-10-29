/**
 * Task evaluation service configuration
 * Anthropic API and proxy settings
 */

// ============================================================================
// Anthropic Configuration
// ============================================================================

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'

// ============================================================================
// Proxy Configuration
// ============================================================================

export const PROXY_HOST = process.env.PROXY_HOST
export const PROXY_USER = process.env.PROXY_USER
export const PROXY_PASS = process.env.PROXY_PASS

/**
 * Get proxy configuration if all required values are set
 */
export function getProxyConfig() {
  if (!PROXY_HOST || !PROXY_USER || !PROXY_PASS) {
    return null
  }

  return {
    host: PROXY_HOST,
    user: PROXY_USER,
    pass: PROXY_PASS,
  }
}

// ============================================================================
// Feature Flags
// ============================================================================

export const MOCK_MODE = process.env.MOCK_MODE === 'true'
