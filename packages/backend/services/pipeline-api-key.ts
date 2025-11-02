/**
 * Pipeline API Key Service
 * Manages automatic API key creation/retrieval for pipeline authentication
 */

import type { Sql } from 'postgres'
import * as apiKeyQueries from '@db/api-keys'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'pipeline-api-key' })

const PIPELINE_KEY_NAME = 'Auto-generated Pipeline Key'
const SYSTEM_USER_ID = 'system'

/**
 * Get or create an API key for pipeline execution
 * This function ensures each project has a dedicated API key for its pipelines
 *
 * @param sql - Database connection
 * @param projectId - Project UUID
 * @returns The API key (plain text) to use for pipeline authentication
 */
export async function getOrCreatePipelineApiKey(
  sql: Sql,
  projectId: string
): Promise<string> {
  try {
    // Try to find existing active pipeline key for this project
    const existingKeys = await apiKeyQueries.findApiKeysByProjectId(sql, projectId)

    // Look for the auto-generated pipeline key
    const pipelineKey = existingKeys.find(key =>
      key.name === PIPELINE_KEY_NAME &&
      key.revoked_at === null &&
      (key.expires_at === null || new Date(key.expires_at) > new Date())
    )

    if (pipelineKey) {
      logger.debug(`Using existing pipeline API key for project ${projectId}`)
      // We can't return the plain text key since it's hashed in the DB
      // This means we need to store the key when we create it
      // For now, we'll always create a new key if we don't have it cached
      // In production, you might want to use a cache or secret manager

      // Since we can't retrieve the plain text key, we need to create a new one
      // Let's revoke the old one and create a new one
      logger.info(`Rotating pipeline API key for project ${projectId}`)
      await apiKeyQueries.revokeApiKey(sql, pipelineKey.id)
    }

    // Create new API key for pipeline
    logger.info(`Creating new pipeline API key for project ${projectId}`)
    const newKey = await apiKeyQueries.createApiKey(
      sql,
      {
        project_id: projectId,
        name: PIPELINE_KEY_NAME,
        permissions: {
          pipeline_execute: true,
          read_project: true,
          read_tasks: true,
          write_tasks: true,
        },
        expires_at: null, // No expiration for pipeline keys
      },
      SYSTEM_USER_ID
    )

    logger.info(`✓ Created pipeline API key for project ${projectId} (${newKey.key_prefix}...)`)

    return newKey.key
  } catch (error) {
    logger.error(`Failed to get/create pipeline API key for project ${projectId}:`, error)
    throw new Error(`Failed to get pipeline API key: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Cache for pipeline API keys (in-memory cache for performance)
 * Maps projectId -> API key
 * Keys are rotated every 24 hours
 */
const pipelineKeyCache = new Map<string, { key: string; createdAt: number }>()
const KEY_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Get or create pipeline API key with caching
 * This is the recommended method to use in pipeline execution
 *
 * @param sql - Database connection
 * @param projectId - Project UUID
 * @returns The API key (plain text) to use for pipeline authentication
 */
export async function getCachedPipelineApiKey(
  sql: Sql,
  projectId: string
): Promise<string> {
  // Check cache first
  const cached = pipelineKeyCache.get(projectId)
  if (cached) {
    const age = Date.now() - cached.createdAt
    if (age < KEY_CACHE_TTL) {
      logger.debug(`Using cached pipeline API key for project ${projectId}`)
      return cached.key
    } else {
      logger.debug(`Cached pipeline API key expired for project ${projectId}, rotating...`)
      pipelineKeyCache.delete(projectId)
    }
  }

  // Get or create new key
  const key = await getOrCreatePipelineApiKey(sql, projectId)

  // Cache it
  pipelineKeyCache.set(projectId, {
    key,
    createdAt: Date.now()
  })

  return key
}

/**
 * Invalidate cached API key for a project
 * Use this when you want to force key rotation
 */
export function invalidatePipelineKeyCache(projectId: string): void {
  pipelineKeyCache.delete(projectId)
  logger.info(`Invalidated pipeline API key cache for project ${projectId}`)
}

/**
 * Clear all cached pipeline API keys
 * Use this for cleanup or testing
 */
export function clearPipelineKeyCache(): void {
  pipelineKeyCache.clear()
  logger.info(`Cleared all pipeline API key cache`)
}
