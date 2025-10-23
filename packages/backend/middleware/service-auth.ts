import type { Context } from 'hono'

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
  const apiToken = process.env.API_TOKEN

  if (!apiToken) {
    return false
  }

  return token === apiToken
}
