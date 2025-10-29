import type { Sql } from 'postgres'
import type { Secret, CreateSecretInput, UpdateSecretInput, Result } from '@types'
import { encrypt, decrypt } from '@adi-simple/shared/crypto-utils'
import * as secretsDb from '../../db/secrets'

const ENCRYPTION_VERSION = 'aes-256-gcm-v1'

export async function createEncryptedSecret(
  sql: Sql,
  input: CreateSecretInput
): Promise<Secret> {
  const encryptedValue = encrypt(input.value)

  const secretData = {
    project_id: input.project_id,
    name: input.name,
    value: '',
    encrypted_value: encryptedValue,
    encryption_version: ENCRYPTION_VERSION,
    is_encrypted: true,
    description: input.description || null
  }

  const [secret] = await sql<Secret[]>`
    INSERT INTO secrets (project_id, name, value, encrypted_value, encryption_version, is_encrypted, description)
    VALUES (
      ${secretData.project_id},
      ${secretData.name},
      ${secretData.value},
      ${secretData.encrypted_value},
      ${secretData.encryption_version},
      ${secretData.is_encrypted},
      ${secretData.description}
    )
    RETURNING *
  `

  if (!secret) {
    throw new Error('Failed to create secret')
  }

  return secret
}

export async function upsertEncryptedSecret(
  sql: Sql,
  input: CreateSecretInput
): Promise<Secret> {
  const encryptedValue = encrypt(input.value)

  const secretData = {
    project_id: input.project_id,
    name: input.name,
    value: '',
    encrypted_value: encryptedValue,
    encryption_version: ENCRYPTION_VERSION,
    is_encrypted: true,
    description: input.description || null
  }

  const [secret] = await sql<Secret[]>`
    INSERT INTO secrets (project_id, name, value, encrypted_value, encryption_version, is_encrypted, description)
    VALUES (
      ${secretData.project_id},
      ${secretData.name},
      ${secretData.value},
      ${secretData.encrypted_value},
      ${secretData.encryption_version},
      ${secretData.is_encrypted},
      ${secretData.description}
    )
    ON CONFLICT (project_id, name)
    DO UPDATE SET
      value = EXCLUDED.value,
      encrypted_value = EXCLUDED.encrypted_value,
      encryption_version = EXCLUDED.encryption_version,
      is_encrypted = EXCLUDED.is_encrypted,
      description = COALESCE(EXCLUDED.description, secrets.description),
      updated_at = NOW()
    RETURNING *
  `

  if (!secret) {
    throw new Error('Failed to upsert secret')
  }

  return secret
}

export async function updateEncryptedSecret(
  sql: Sql,
  id: string,
  input: UpdateSecretInput
): Promise<Result<Secret>> {
  const updateData: any = {
    updated_at: new Date()
  }

  if (input.value !== undefined) {
    updateData.encrypted_value = encrypt(input.value)
    updateData.encryption_version = ENCRYPTION_VERSION
    updateData.is_encrypted = true
    updateData.value = ''
  }

  if (input.description !== undefined) {
    updateData.description = input.description
  }

  const [secret] = await sql<Secret[]>`
    UPDATE secrets
    SET
      encrypted_value = COALESCE(${updateData.encrypted_value}, encrypted_value),
      encryption_version = COALESCE(${updateData.encryption_version}, encryption_version),
      is_encrypted = COALESCE(${updateData.is_encrypted}, is_encrypted),
      value = COALESCE(${updateData.value}, value),
      description = COALESCE(${updateData.description}, description),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  return secret
    ? { ok: true, data: secret }
    : { ok: false, error: 'Secret not found' }
}

export async function getDecryptedSecretValue(sql: Sql, secretId: string): Promise<string> {
  const result = await secretsDb.findSecretById(sql, secretId)

  if (!result.ok) {
    throw new Error('Secret not found')
  }

  const secret = result.data

  if (secret.is_encrypted && secret.encrypted_value) {
    return decrypt(secret.encrypted_value)
  }

  if (secret.value) {
    return secret.value
  }

  throw new Error('Secret value is empty')
}

export async function getDecryptedSecretByName(
  sql: Sql,
  projectId: string,
  name: string
): Promise<string> {
  const result = await secretsDb.findSecretByProjectAndName(sql, projectId, name)

  if (!result.ok) {
    throw new Error(`Secret '${name}' not found for project ${projectId}`)
  }

  const secret = result.data

  if (secret.is_encrypted && secret.encrypted_value) {
    return decrypt(secret.encrypted_value)
  }

  if (secret.value) {
    return secret.value
  }

  throw new Error('Secret value is empty')
}

export function maskSecretValue(value: string): string {
  if (value.length <= 4) {
    return '****'
  }
  return '*'.repeat(value.length - 4) + value.slice(-4)
}

export function sanitizeSecretForResponse(secret: Secret): Omit<Secret, 'value' | 'encrypted_value'> & { value_masked: string } {
  const { value, encrypted_value, ...rest } = secret
  const actualValue = secret.is_encrypted && encrypted_value
    ? decrypt(encrypted_value)
    : value

  return {
    ...rest,
    value_masked: maskSecretValue(actualValue)
  }
}

export async function getSecretWithMetadata(sql: Sql, secretId: string): Promise<{ value: string; tokenType: 'oauth' | 'api' | null }> {
  const result = await secretsDb.findSecretById(sql, secretId)

  if (!result.ok) {
    throw new Error('Secret not found')
  }

  const secret = result.data

  let decryptedValue: string
  if (secret.is_encrypted && secret.encrypted_value) {
    decryptedValue = decrypt(secret.encrypted_value)
  } else if (secret.value) {
    decryptedValue = secret.value
  } else {
    throw new Error('Secret value is empty')
  }

  return {
    value: decryptedValue,
    tokenType: secret.token_type
  }
}
