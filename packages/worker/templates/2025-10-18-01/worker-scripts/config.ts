/**
 * Worker scripts configuration
 * Environment variables for pipeline execution
 */

// ============================================================================
// API Configuration
// ============================================================================

export const API_BASE_URL = process.env.API_BASE_URL || ''
export const API_TOKEN = process.env.API_TOKEN || ''

// ============================================================================
// Session & Pipeline Context
// ============================================================================

export const SESSION_ID = process.env.SESSION_ID || ''
export const PIPELINE_EXECUTION_ID = process.env.PIPELINE_EXECUTION_ID || ''
export const PROJECT_ID = process.env.PROJECT_ID || ''

// ============================================================================
// Workspace Configuration
// ============================================================================

export const WORKSPACE_COUNT = parseInt(process.env.WORKSPACE_COUNT || '0')
export const WORKSPACE_DIRS = process.env.WORKSPACE_DIRS || ''
export const WORKSPACE_NAMES = process.env.WORKSPACE_NAMES || ''
export const WORKSPACE_BRANCHES = process.env.WORKSPACE_BRANCHES || ''
export const FILE_SPACES = process.env.FILE_SPACES || ''

// ============================================================================
// Git Configuration
// ============================================================================

export const GITLAB_TOKEN = process.env.GITLAB_TOKEN || ''
export const WORKER_REPO_TOKEN = process.env.WORKER_REPO_TOKEN || ''
export const CI_COMMIT_REF_NAME = process.env.CI_COMMIT_REF_NAME || 'main'

// ============================================================================
// Anthropic Configuration
// ============================================================================

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''

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
