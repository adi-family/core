/**
 * Backend API Client
 * Provides typed HTTP client using Hono RPC for all backend operations
 */

import { hcWithType } from './client'
import { BACKEND_URL, API_TOKEN } from './config'

export const createBackendClient = (baseUrl: string, apiToken?: string) => {
  return hcWithType(baseUrl, {
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {}
  })
}

export type BackendClient = ReturnType<typeof createBackendClient>

export function createBackendApiClient(): BackendClient {
  return createBackendClient(BACKEND_URL, API_TOKEN)
}
