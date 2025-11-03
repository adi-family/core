/**
 * Secrets API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * Get decrypted secret value by ID
 * GET /api/secrets/:id/value
 */
export const getSecretValueConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/:id/value', z.object({ id: z.string() })),
  response: {
    schema: z.object({
      value: z.string()
    })
  }
} as const

/**
 * List all secrets
 * GET /api/secrets
 */
export const listSecretsConfig = {
  method: 'GET',
  route: route.static('/api/secrets'),
  response: {
    schema: z.any()
  }
} as const

/**
 * Get secrets by project ID
 * GET /api/secrets/by-project/:projectId
 */
export const getSecretsByProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/secrets/by-project/:projectId', z.object({ projectId: z.string() })),
  response: {
    schema: z.any()
  }
} as const
