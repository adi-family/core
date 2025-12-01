/**
 * Authentication utilities for backend handlers
 */

import { verifyToken } from '@clerk/backend'
import { createLogger } from '@utils/logger'
import { CLERK_SECRET_KEY } from '../config'
import type { Sql } from 'postgres'
import type { HandlerContext, HandlerConfig, Handler } from '@adi-family/http'
import { handler as baseHandler } from '@adi-family/http'
import { z } from 'zod'
import * as userAccessQueries from '@db/user-access'
import * as apiKeyQueries from '@db/api-keys'
import type { Role } from '@db/user-access'
import { createAcl, type Acl } from '@db/acl'
import { NotFoundException, BadRequestException, NotEnoughRightsException, AuthRequiredException } from '@utils/exceptions'

const logger = createLogger({ namespace: 'auth-utils' })

interface HttpError extends Error {
  statusCode: number
  name: string
}

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
export async function authenticate(sql: Sql, ctx: HandlerContext<unknown, unknown, unknown>): Promise<AuthResult> {
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

/**
 * Secured handler context - provides ACL and sql
 */
export interface SecuredHandlerContext<TParams, TQuery, TBody> {
  params: TParams
  query: TQuery
  body: TBody
  headers: Headers
  acl: Acl
  sql: Sql
  userId: string
}

type SecuredHandlerFunction<TParams, TQuery, TBody, TResponse> = (
  ctx: SecuredHandlerContext<TParams, TQuery, TBody>
) => Promise<TResponse>

/**
 * Map custom exceptions to HTTP status codes
 */
const mapExceptionToHttpError = (error: unknown): never => {
  if (error instanceof NotFoundException) {
    const httpError = new Error(error.message) as HttpError
    httpError.statusCode = 404
    httpError.name = 'NotFoundException'
    throw httpError
  }

  if (error instanceof BadRequestException) {
    const httpError = new Error(error.message) as HttpError
    httpError.statusCode = 400
    httpError.name = 'BadRequestException'
    throw httpError
  }

  if (error instanceof AuthRequiredException) {
    const httpError = new Error(error.message) as HttpError
    httpError.statusCode = 401
    httpError.name = 'AuthRequiredException'
    throw httpError
  }

  if (error instanceof NotEnoughRightsException) {
    const httpError = new Error(error.message) as HttpError
    httpError.statusCode = 403
    httpError.name = 'NotEnoughRightsException'
    throw httpError
  }

  throw error
}

/**
 * Create a secured handler that enforces ACL-based access control
 *
 * Handlers using this wrapper:
 * - Provides `acl` for access checks and `sql` for queries
 * - Automatically authenticate user via Clerk JWT
 * - Map exceptions to proper HTTP status codes
 *
 * @example
 * const getProject = securedHandler(sql, getProjectConfig, async (ctx) => {
 *   await ctx.acl.project(ctx.params.id).viewer()
 *   return queries.findProjectById(ctx.sql, ctx.params.id)
 * })
 */
export function securedHandler<TParams = object, TQuery = object, TBody = unknown, TResponse = unknown>(
  sql: Sql,
  config: HandlerConfig<TParams, TQuery, TBody, TResponse>,
  fn: SecuredHandlerFunction<TParams, TQuery, TBody, TResponse>
): Handler<TParams, TQuery, TBody, TResponse> {
  return baseHandler(config, async (ctx) => {
    try {
      const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
      const acl = createAcl({ userId, sql })

      const securedCtx: SecuredHandlerContext<TParams, TQuery, TBody> = {
        params: ctx.params,
        query: ctx.query,
        body: ctx.body,
        headers: ctx.headers,
        acl,
        sql,
        userId
      }

      return await fn(securedCtx)
    } catch (error) {
      return mapExceptionToHttpError(error)
    }
  })
}

/**
 * Factory to create secured handlers with pre-bound sql connection
 *
 * @example
 * const { handler } = createSecuredHandlers(sql)
 *
 * const getProject = handler(getProjectConfig, async (ctx) => {
 *   return ctx.acl.viewer.gte(ctx.params.id).query(sql => findProjectById(sql, ctx.params.id))
 * })
 */
export const createSecuredHandlers = (sql: Sql) => ({
  handler: <TParams = object, TQuery = object, TBody = unknown, TResponse = unknown>(
    config: HandlerConfig<TParams, TQuery, TBody, TResponse>,
    fn: SecuredHandlerFunction<TParams, TQuery, TBody, TResponse>
  ) => securedHandler(sql, config, fn)
})
