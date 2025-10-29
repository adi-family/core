import type { Context, Next } from 'hono'
import { createLogger } from '@utils/logger.ts'
import { API_TOKEN } from '../config'

const logger = createLogger({ namespace: 'auth' })

/**
 * Authentication middleware for API endpoints
 * Validates Bearer token against API_TOKEN environment variable
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.replace('Bearer ', '')

  if (!API_TOKEN) {
    logger.error('API_TOKEN environment variable not set')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  if (token !== API_TOKEN) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}
