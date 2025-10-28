import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Secret, CreateSecretInput, UpdateSecretInput, Result } from '@types'
import { filterPresentColumns } from './utils'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllSecrets = async (sql: Sql): Promise<Secret[]> => {
  return get(sql<Secret[]>`SELECT * FROM secrets ORDER BY created_at DESC`)
}

export const findSecretsByProjectId = async (sql: Sql, projectId: string): Promise<Secret[]> => {
  return get(sql<Secret[]>`SELECT * FROM secrets WHERE project_id = ${projectId} ORDER BY name`)
}

export const findSecretById = async (sql: Sql, id: string): Promise<Result<Secret>> => {
  const secrets = await get(sql<Secret[]>`SELECT * FROM secrets WHERE id = ${id}`)
  const [secret] = secrets
  return secret
    ? { ok: true, data: secret }
    : { ok: false, error: 'Secret not found' }
}

export const findSecretByProjectAndName = async (sql: Sql, projectId: string, name: string): Promise<Result<Secret>> => {
  const secrets = await get(sql<Secret[]>`SELECT * FROM secrets WHERE project_id = ${projectId} AND name = ${name}`)
  const [secret] = secrets
  return secret
    ? { ok: true, data: secret }
    : { ok: false, error: 'Secret not found' }
}

const createSecretCols = ['project_id', 'name', 'value', 'description', 'oauth_provider', 'token_type', 'refresh_token', 'expires_at', 'scopes'] as const
export const createSecret = async (sql: Sql, input: CreateSecretInput): Promise<Result<Secret>> => {
  const presentCols = filterPresentColumns(input, createSecretCols)

  const [secret] = await get(sql<Secret[]>`
    INSERT INTO secrets ${sql(input, presentCols)}
    RETURNING *
  `)
  if (!secret) {
    return { ok: false, error: 'Failed to create secret' }
  }
  return { ok: true, data: secret }
}

const updateSecretCols = ['value', 'description', 'refresh_token', 'expires_at', 'scopes'] as const
export const updateSecret = async (sql: Sql, id: string, input: UpdateSecretInput): Promise<Result<Secret>> => {
  const presentCols = filterPresentColumns(input, updateSecretCols)

  const secrets = await get(sql<Secret[]>`
    UPDATE secrets
    SET ${sql(input, presentCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [secret] = secrets
  return secret
    ? { ok: true, data: secret }
    : { ok: false, error: 'Secret not found' }
}

export const deleteSecret = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM secrets WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Secret not found' }
}
