import { clerkMiddleware, getAuth } from '@hono/clerk-auth'
import type { Context, Next, MiddlewareHandler } from 'hono'
import { createLogger } from '@utils/logger.ts'

const logger = createLogger({ namespace: 'clerk' })

/**
 * Clerk authentication middleware
 * Sets userId in context if user is authenticated
 *
 * Required environment variables:
 * - CLERK_SECRET_KEY
 * - CLERK_PUBLISHABLE_KEY
 */
export const clerkAuth = clerkMiddleware()

/**
 * Middleware to require Clerk authentication
 * Returns 401 if user is not authenticated
 */
export const requireClerkAuth = (): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const auth = getAuth(c)

    if (!auth?.userId) {
      logger.warn('Unauthorized request - no Clerk userId')
      return c.json({ error: 'Authentication required' }, 401)
    }

    // Set userId in context for downstream handlers
    c.set('userId', auth.userId)

    await next()
  }
}

/**
 * Optional Clerk authentication
 * Sets userId in context if authenticated, but doesn't require it
 */
export const optionalClerkAuth = (): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const auth = getAuth(c)

    if (auth?.userId) {
      c.set('userId', auth.userId)
    }

    await next()
  }
}

/**
 * Get user ID from Clerk context
 * Returns null if not authenticated
 */
export const getClerkUserId = (c: Context): string | null => {
  const auth = getAuth(c)
  return auth?.userId ?? null
}
