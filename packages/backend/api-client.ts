/**
 * Backend API Client
 * Provides a typed client for internal backend-to-backend API calls using @adi-family/http
 */

import { BaseClient } from '@adi-family/http'
import { API_BASE_URL, API_TOKEN } from './config'

/**
 * Backend API client type - uses BaseClient with .run() method
 */
export type BackendClient = BaseClient

/**
 * Create a backend API client with authentication
 * Uses API_BASE_URL and API_TOKEN from environment configuration
 *
 * @example
 * ```typescript
 * const client = createBackendApiClient()
 * const project = await client.run(getProjectConfig, { params: { id: '123' } })
 * ```
 */
export function createBackendApiClient(): BackendClient {
  return new BaseClient({
    baseUrl: API_BASE_URL,
    fetch: (input, init) => {
      const headers = new Headers(init?.headers || {})

      if (API_TOKEN) {
        headers.set('Authorization', `Bearer ${API_TOKEN}`)
      }

      return fetch(input, {
        ...init,
        headers,
        credentials: 'include'
      })
    }
  })
}
