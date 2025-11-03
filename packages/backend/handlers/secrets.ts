/**
 * Secrets handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  listSecretsConfig,
  getSecretsByProjectConfig
} from '@adi/api-contracts/secrets'
import * as secretQueries from '@db/secrets'

export function createSecretHandlers(sql: Sql) {
  const listSecrets = handler(listSecretsConfig, async (_ctx) => {
    const secrets = await secretQueries.findAllSecrets(sql)

    // Exclude the encrypted value field for security
    return secrets.map(secret => ({
      id: secret.id,
      name: secret.name,
      project_id: secret.project_id,
      description: secret.description,
      oauth_provider: secret.oauth_provider,
      token_type: secret.token_type,
      expires_at: secret.expires_at,
      scopes: secret.scopes,
      created_at: secret.created_at,
      updated_at: secret.updated_at
    }))
  })

  const getSecretsByProject = handler(getSecretsByProjectConfig, async (ctx) => {
    const { projectId } = ctx.params
    const secrets = await secretQueries.findSecretsByProjectId(sql, projectId)

    // Exclude the encrypted value field for security
    return secrets.map(secret => ({
      id: secret.id,
      name: secret.name,
      description: secret.description,
      oauth_provider: secret.oauth_provider,
      token_type: secret.token_type,
      expires_at: secret.expires_at,
      scopes: secret.scopes,
      created_at: secret.created_at,
      updated_at: secret.updated_at
    }))
  })

  return {
    listSecrets,
    getSecretsByProject
  }
}
