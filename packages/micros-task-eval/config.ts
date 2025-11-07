/**
 * Task evaluation service configuration
 * Anthropic API and proxy settings
 */

import { DEFAULT_MODELS, getProxyConfig as getProxyConfigFromShared, FEATURE_FLAGS } from '@adi-simple/config'

// ============================================================================
// Anthropic Configuration
// ============================================================================

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || DEFAULT_MODELS.anthropic

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

export const MOCK_MODE = FEATURE_FLAGS.mockMode
