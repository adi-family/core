import { hc } from 'hono/client'
import type { AppType } from '../../../backend/app'

const SERVER_PORT = import.meta.env.VITE_SERVER_PORT
  ? import.meta.env.VITE_SERVER_PORT
  : '5174'

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : `http://localhost:${SERVER_PORT}`

/**
 * Create authenticated Hono client with Clerk token
 */
export function createAuthenticatedClient(getToken: () => Promise<string | null>) {
  return hc<AppType>(API_URL, {
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const token = await getToken()

      const headers = new Headers(init?.headers || {})
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      return fetch(input, {
        ...init,
        headers,
      })
    },
  })
}

/**
 * Unauthenticated client (for backwards compatibility)
 * Use createAuthenticatedClient() in components with useAuth()
 */
export const client = hc<AppType>(API_URL)
