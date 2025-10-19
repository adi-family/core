/**
 * Backend API Client for Worker
 * Provides typed HTTP client using Hono RPC for all backend operations
 */

import { hc } from 'hono/client'
import type { AppType } from '../backend/app'

export const createBackendClient = (baseUrl: string, apiToken?: string) => {
  return hc<AppType>(baseUrl, {
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {}
  })
}

export type BackendClient = ReturnType<typeof createBackendClient>
