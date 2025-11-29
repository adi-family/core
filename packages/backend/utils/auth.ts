/**
 * Authentication utilities for backend handlers
 */

import { verifyToken } from '@clerk/backend'
import { createLogger } from '@utils/logger'
import { CLERK_SECRET_KEY } from '../config'
import type { Sql } from 'postgres'
import type { HandlerContext } from '@adi-family/http'
import { z } from 'zod'
import * as userAccessQueries from '@db/user-access'
import * as apiKeyQueries from '@db/api-keys'
import type { Role } from '@db/user-access'

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
      'owner': 'Forbidden: You need owner role to perform this action',
      'read': 'Forbidden: You need read access to perform this action',
      'write': 'Forbidden: You need write access to perform this action',
      'use': 'Forbidden: You need use access to perform this action'
    }
    throw new Error(roleMessages[minRole] || 'Forbidden: Access denied')
  }
}

/**
 * Require that a user has admin access (owner or admin of at least one project)
 * @param sql - Postgres connection
 * @param userId - The user ID to check
 * @throws Error if user does not have admin access
 */
export async function requireAdminAccess(sql: Sql, userId: string): Promise<void> {
  const hasAdminAccess = await userAccessQueries.hasAdminAccess(sql, userId)
  if (!hasAdminAccess) {
    throw new Error('Forbidden: Admin access required. You must be an owner or admin of at least one project.')
  }
}

export const authResultSchema = z.object({
  userId: z.string().optional(),
  projectId: z.string().optional(),
  isApiKey: z.boolean()
})

export type AuthResult = z.infer<typeof authResultSchema>

/**
 * Authenticate request using either API key or Clerk JWT token
 * @param sql - Postgres connection
 * @param ctx - Handler context with headers
 * @returns AuthResult with userId or projectId and authentication type
 * @throws Error if authentication fails
 */
export async function authenticate(sql: Sql, ctx: HandlerContext<any, any, any>): Promise<AuthResult> {
  const authHeader = ctx.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Unauthorized: No Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    throw new Error('Unauthorized: Invalid token format')
  }

  // Check if this is an API key (starts with adk_)
  if (token.startsWith('adk_')) {
    logger.debug('Authenticating with API key')
    const validation = await apiKeyQueries.validateApiKey(sql, token)

    if (!validation.valid || !validation.projectId) {
      throw new Error('Unauthorized: Invalid API key')
    }

    // Check if API key has permission to access file spaces
    if (!validation.apiKey?.permissions?.read_project) {
      throw new Error('Forbidden: API key does not have permission to access file spaces')
    }

    return {
      projectId: validation.projectId,
      isApiKey: true
    }
  }

  // Otherwise, treat as Clerk JWT token
  logger.debug('Authenticating with Clerk token')
  if (!CLERK_SECRET_KEY) {
    throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
  }

  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
    if (!payload.sub) {
      throw new Error('Unauthorized: Invalid token payload')
    }
    return {
      userId: payload.sub,
      isApiKey: false
    }
  } catch (error) {
    logger.error('Token verification failed:', error)
    throw new Error('Unauthorized: Token verification failed')
  }
}
