import { BaseClient } from '@adi-family/http'
import { API_BASE_URL, API_TOKEN } from './config'

export type BackendClient = BaseClient

export function createBackendApiClient(): BackendClient {
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
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

  return new BaseClient({
    baseUrl: API_BASE_URL,
    fetch: customFetch as typeof fetch
  })
}
