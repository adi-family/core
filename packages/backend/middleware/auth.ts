import type { Context, Next } from 'hono'
import { createLogger } from '@utils/logger.ts'

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
  const apiToken = process.env.API_TOKEN

  if (!apiToken) {
    logger.error('API_TOKEN environment variable not set')
    return c.json({ error: 'Server configuration error' }, 500)
  }

  if (token !== apiToken) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}
