import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Secret, CreateSecretInput, UpdateSecretInput, Result } from '@types'
import { filterPresentColumns } from './utils'
import { NotFoundException } from '../utils/exceptions'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllSecrets = async (sql: Sql): Promise<Secret[]> => {
  return get(sql<Secret[]>`SELECT * FROM secrets ORDER BY created_at DESC`)
}

export const findSecretsByProjectId = async (sql: Sql, projectId: string): Promise<Secret[]> => {
  return get(sql<Secret[]>`SELECT * FROM secrets WHERE project_id = ${projectId} ORDER BY name`)
}

export const findSecretById = async (sql: Sql, id: string): Promise<Secret> => {
  const secrets = await get(sql<Secret[]>`SELECT * FROM secrets WHERE id = ${id}`)
  const [secret] = secrets
  if (!secret) {
    throw new NotFoundException('Secret not found')
  }
  return secret
}

export const findSecretByProjectAndName = async (sql: Sql, projectId: string, name: string): Promise<Secret> => {
  const secrets = await get(sql<Secret[]>`SELECT * FROM secrets WHERE project_id = ${projectId} AND name = ${name}`)
  const [secret] = secrets
  if (!secret) {
    throw new NotFoundException('Secret not found')
  }
  return secret
}

const createSecretCols = ['project_id', 'name', 'value', 'description', 'oauth_provider', 'token_type', 'refresh_token', 'expires_at', 'scopes'] as const
export const createSecret = async (sql: Sql, input: CreateSecretInput): Promise<Secret> => {
  const presentCols = filterPresentColumns(input, createSecretCols)

  const [secret] = await get(sql<Secret[]>`
    INSERT INTO secrets ${sql(input, presentCols)}
    RETURNING *
  `)
  if (!secret) {
    throw new Error('Failed to create secret')
  }
  return secret
}

const updateSecretCols = ['value', 'description', 'refresh_token', 'expires_at', 'scopes'] as const
export const updateSecret = async (sql: Sql, id: string, input: UpdateSecretInput): Promise<Secret> => {
  const presentCols = filterPresentColumns(input, updateSecretCols)

  const secrets = await get(sql<Secret[]>`
    UPDATE secrets
    SET ${sql(input, presentCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [secret] = secrets
  if (!secret) {
    throw new NotFoundException('Secret not found')
  }
  return secret
}

export type UpsertSecretInput = {
  project_id: string
  name: string
  value: string
  description?: string
  oauth_provider?: string
  token_type?: 'api' | 'oauth'
  refresh_token?: string
  expires_at?: string
  scopes?: string
}

export const upsertSecret = async (sql: Sql, input: UpsertSecretInput): Promise<Secret> => {
  const { project_id, name, ...updateFields } = input

  try {
    // Check if secret exists
    const existingSecret = await findSecretByProjectAndName(sql, project_id, name)
    // Update existing secret
    return updateSecret(sql, existingSecret.id, updateFields)
  } catch (error) {
    if (error instanceof NotFoundException) {
      // Create new secret
      return createSecret(sql, input)
    }
    throw error
  }
}

export const deleteSecret = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM secrets WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('Secret not found')
  }
}
