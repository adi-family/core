import type { Context } from 'hono'
import { API_TOKEN } from '../config'

/**
 * Check if the request is authenticated with API_TOKEN (internal service call)
 * Returns true if the Authorization header contains the correct API_TOKEN
 */
export function isServiceAuthenticated(c: Context): boolean {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return false
  }

  const token = authHeader.replace('Bearer ', '')

  if (!API_TOKEN) {
    return false
  }

  return token === API_TOKEN
}
