import type { MaybeRow, PendingQuery, Sql } from 'postgres'
import type { ApiKey, ApiKeyWithSecret, CreateApiKeyInput, UpdateApiKeyInput } from '@types'
import { NotFoundException } from '../utils/exceptions'
import { randomBytes, createHash } from 'crypto'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

/**
 * Generate a secure API key with prefix
 * Format: adk_<random_32_bytes_hex>
 */
export const generateApiKey = (): string => {
  const randomPart = randomBytes(32).toString('hex')
  return `adk_${randomPart}`
}

/**
 * Hash an API key for storage
 */
export const hashApiKey = (key: string): string => {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Extract key prefix for display (first 12 characters)
 */
export const getKeyPrefix = (key: string): string => {
  return key.substring(0, 12)
}

/**
 * Find all API keys for a project (excluding revoked)
 */
export const findApiKeysByProjectId = async (sql: Sql, projectId: string): Promise<ApiKey[]> => {
  return get(sql<ApiKey[]>`
    SELECT * FROM api_keys
    WHERE project_id = ${projectId}
    AND revoked_at IS NULL
    ORDER BY created_at DESC
  `)
}

/**
 * Find all API keys for a project including revoked
 */
export const findAllApiKeysByProjectId = async (sql: Sql, projectId: string): Promise<ApiKey[]> => {
  return get(sql<ApiKey[]>`
    SELECT * FROM api_keys
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `)
}

/**
 * Find API key by ID
 */
export const findApiKeyById = async (sql: Sql, id: string): Promise<ApiKey> => {
  const keys = await get(sql<ApiKey[]>`SELECT * FROM api_keys WHERE id = ${id}`)
  const [key] = keys
  if (!key) {
    throw new NotFoundException('API key not found')
  }
  return key
}

/**
 * Find API key by hash (for authentication)
 */
export const findApiKeyByHash = async (sql: Sql, keyHash: string): Promise<ApiKey | null> => {
  const keys = await get(sql<ApiKey[]>`
    SELECT * FROM api_keys
    WHERE key_hash = ${keyHash}
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  `)
  const [key] = keys
  return key || null
}

/**
 * Create a new API key
 * Returns the API key with the plain text key (only time it's visible)
 */
export const createApiKey = async (
  sql: Sql,
  input: CreateApiKeyInput,
  createdBy: string
): Promise<ApiKeyWithSecret> => {
  const key = generateApiKey()
  const keyHash = hashApiKey(key)
  const keyPrefix = getKeyPrefix(key)

  const permissions = input.permissions || {
    pipeline_execute: true,
    read_project: true
  }

  const [apiKey] = await get(sql<ApiKey[]>`
    INSERT INTO api_keys (
      project_id,
      name,
      key_hash,
      key_prefix,
      permissions,
      expires_at,
      created_by
    )
    VALUES (
      ${input.project_id},
      ${input.name},
      ${keyHash},
      ${keyPrefix},
      ${sql.json(permissions)},
      ${input.expires_at || null},
      ${createdBy}
    )
    RETURNING *
  `)

  if (!apiKey) {
    throw new Error('Failed to create API key')
  }

  return {
    ...apiKey,
    key
  }
}

/**
 * Update API key
 */
export const updateApiKey = async (
  sql: Sql,
  id: string,
  input: UpdateApiKeyInput
): Promise<ApiKey> => {
  const updates: string[] = []
  const values: any[] = []

  if (input.name !== undefined) {
    updates.push(`name = $${updates.length + 1}`)
    values.push(input.name)
  }

  if (input.permissions !== undefined) {
    updates.push(`permissions = $${updates.length + 1}::jsonb`)
    values.push(JSON.stringify(input.permissions))
  }

  if (updates.length === 0) {
    return findApiKeyById(sql, id)
  }

  const keys = await get(sql<ApiKey[]>`
    UPDATE api_keys
    SET ${sql.unsafe(updates.join(', '))}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)

  const [key] = keys
  if (!key) {
    throw new NotFoundException('API key not found')
  }
  return key
}

/**
 * Revoke an API key
 */
export const revokeApiKey = async (sql: Sql, id: string): Promise<ApiKey> => {
  const keys = await get(sql<ApiKey[]>`
    UPDATE api_keys
    SET revoked_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
    AND revoked_at IS NULL
    RETURNING *
  `)

  const [key] = keys
  if (!key) {
    throw new NotFoundException('API key not found or already revoked')
  }
  return key
}

/**
 * Update last used timestamp for API key
 */
export const updateApiKeyLastUsed = async (sql: Sql, keyHash: string): Promise<void> => {
  await get(sql`
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE key_hash = ${keyHash}
  `)
}

/**
 * Delete an API key (hard delete)
 */
export const deleteApiKey = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM api_keys WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('API key not found')
  }
}

/**
 * Validate API key and return associated project ID
 */
export const validateApiKey = async (sql: Sql, key: string): Promise<{ valid: boolean; projectId?: string; apiKey?: ApiKey }> => {
  const keyHash = hashApiKey(key)
  const apiKey = await findApiKeyByHash(sql, keyHash)

  if (!apiKey) {
    return { valid: false }
  }

  // Update last used timestamp asynchronously
  updateApiKeyLastUsed(sql, keyHash).catch(err => {
    console.error('Failed to update API key last_used_at:', err)
  })

  return {
    valid: true,
    projectId: apiKey.project_id,
    apiKey
  }
}
