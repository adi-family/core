/**
 * Authentication utilities for backend handlers
 */

import { verifyToken } from '@clerk/backend'
import { createLogger } from '@utils/logger'
import { CLERK_SECRET_KEY } from '../config'
import type { Sql } from 'postgres'
import * as userAccessQueries from '@db/user-access'
import type { Role } from '@types'

const logger = createLogger({ namespace: 'auth-utils' })

/**
 * Extract and verify user ID from Clerk authentication token
 * @param authHeader - The Authorization header value (e.g., "Bearer <token>")
 * @returns The user ID from the token
 * @throws Error if authentication fails
 */
export async function getUserIdFromClerkToken(authHeader: string | null): Promise<string> {
  if (!authHeader) {
    throw new Error('Unauthorized: No Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    throw new Error('Unauthorized: Invalid token format')
  }

  if (!CLERK_SECRET_KEY) {
    throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
  }

  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
    if (!payload.sub) {
      throw new Error('Unauthorized: Invalid token payload')
    }
    return payload.sub
  } catch (error) {
    logger.error('Token verification failed:', error)
    throw new Error('Unauthorized: Token verification failed')
  }
}

/**
 * Require that a user has access to a project with a minimum role
 * @param sql - Postgres connection
 * @param userId - The user ID to check
 * @param projectId - The project ID to check access for
 * @param minRole - The minimum required role (default: 'viewer')
 * @param errorMessage - Custom error message (optional)
 * @throws Error if user does not have required access
 */
export async function requireProjectAccess(
  sql: Sql,
  userId: string,
  projectId: string,
  minRole: Role = 'viewer',
  errorMessage?: string
): Promise<void> {
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId, minRole)
  if (!hasAccess) {
    if (errorMessage) {
      throw new Error(errorMessage)
    }

    // Generate default error message based on role
    const roleMessages: Record<Role, string> = {
      'viewer': 'Forbidden: You do not have access to this project',
      'developer': 'Forbidden: You need developer role or higher to perform this action',
      'admin': 'Forbidden: You need admin role to perform this action',
      'owner': 'Forbidden: You need owner role to perform this action'
    }
    throw new Error(roleMessages[minRole] || 'Forbidden: Access denied')
  }
}
