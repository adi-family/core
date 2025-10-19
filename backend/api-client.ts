/**
 * Backend API Client
 * Provides typed HTTP client using Hono RPC for all backend operations
 */

import { hc } from 'hono/client'
import type { AppType } from './app'

export const createBackendClient = (baseUrl: string, apiToken?: string) => {
  return hc<AppType>(baseUrl, {
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {}
  })
}

export type BackendClient = ReturnType<typeof createBackendClient>

export function createBackendApiClient(): BackendClient {
  const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.SERVER_PORT || 3000}`
  const apiToken = process.env.API_TOKEN

  return createBackendClient(baseUrl, apiToken)
}
