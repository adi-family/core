import { BaseClient } from '@adi-family/http'

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT
  ? import.meta.env.VITE_SERVER_PORT
  : '5174'

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : `http://localhost:${SERVER_PORT}`

/**
 * Create authenticated API client with Clerk token
 */
export function createAuthenticatedClient(getToken: () => Promise<string | null>) {
  return new BaseClient({
    baseUrl: API_URL,
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const token = await getToken()

      const headers = new Headers(init?.headers || {})
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      return fetch(input, {
        ...init,
        headers,
        credentials: 'include'
      })
    },
  })
}

/**
 * Unauthenticated client (for backwards compatibility)
 * Use createAuthenticatedClient() in components with useAuth()
 */
export const client = new BaseClient({
  baseUrl: API_URL,
  fetch: (input, init) => fetch(input, { ...init, credentials: 'include' })
})
