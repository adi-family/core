import type { Context } from 'hono'
import type { Sql } from 'postgres'
import { validateApiKey } from '../../db/api-keys'

/**
 * Extract API key from Authorization header
 * Supports both "Bearer adk_..." and "adk_..." formats
 */
export const extractApiKey = (c: Context): string | null => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return null
  }

  // Remove "Bearer " prefix if present
  const key = authHeader.replace(/^Bearer\s+/i, '')

  // Check if it's an API key (starts with adk_)
  if (!key.startsWith('adk_')) {
    return null
  }

  return key
}

/**
 * Check if request is authenticated with an API key
 * Returns the validated API key info if valid, null otherwise
 */
export const getApiKeyAuth = async (c: Context, sql: Sql) => {
  const key = extractApiKey(c)

  if (!key) {
    return null
  }

  const result = await validateApiKey(sql, key)

  if (!result.valid || !result.apiKey) {
    return null
  }

  return result
}

/**
 * Store API key info in context for later use
 */
export const setApiKeyContext = (c: Context, apiKeyInfo: { projectId: string; apiKey: any }) => {
  c.set('apiKeyAuth', apiKeyInfo)
}

/**
 * Get API key info from context
 */
export const getApiKeyContext = (c: Context): { projectId: string; apiKey: any } | undefined => {
  return c.get('apiKeyAuth')
}

/**
 * Check if current request is authenticated via API key
 */
export const isApiKeyAuthenticated = (c: Context): boolean => {
  return !!getApiKeyContext(c)
}

/**
 * Get project ID from API key context
 */
export const getProjectIdFromApiKey = (c: Context): string | null => {
  const apiKeyInfo = getApiKeyContext(c)
  return apiKeyInfo?.projectId || null
}
