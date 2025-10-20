import type { Context, Next, MiddlewareHandler } from 'hono'
import type { Sql } from 'postgres'
import type { EntityType, Role } from '../../db/user-access'
import { hasProjectAccess, hasAccessToResource } from '../../db/user-access'
import { createLogger } from '@utils/logger.ts'

const logger = createLogger({ namespace: 'access-control' })

/**
 * Extract user ID from Clerk authentication
 * Assumes Clerk middleware has already run and set user info in context
 */
const getUserId = (c: Context): string | null => {
  // Clerk sets this in context when authentication is enabled
  return (c.get('userId') as string | undefined) || null
}

/**
 * Middleware factory to require project-level access
 * @param sql Database connection
 * @param minRole Minimum required project role (owner, admin, developer, viewer)
 * @param getProjectId Optional function to extract project ID from context (defaults to c.req.param('projectId'))
 */
export const requireProjectAccess = (
  sql: Sql,
  minRole: Role = 'viewer',
  getProjectId?: (c: Context) => string | null
): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const userId = getUserId(c)
    if (!userId) {
      logger.warn('Access denied: No user ID in context')
      return c.json({ error: 'Authentication required' }, 401)
    }

    const projectId = getProjectId ? getProjectId(c) : c.req.param('projectId')
    if (!projectId) {
      logger.warn('Access denied: No project ID found')
      return c.json({ error: 'Project ID required' }, 400)
    }

    const hasAccess = await hasProjectAccess(sql, userId, projectId, minRole)
    if (!hasAccess) {
      logger.warn(`Access denied: User ${userId} lacks ${minRole} access to project ${projectId}`)
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    await next()
  }
}

/**
 * Middleware factory to require resource-level access
 * @param sql Database connection
 * @param entityType Type of entity (task_source, file_space, secret, task)
 * @param requiredRole Required role for the resource (read, write, use)
 * @param getEntityId Optional function to extract entity ID from context (defaults to c.req.param('id'))
 */
export const requireResourceAccess = (
  sql: Sql,
  entityType: EntityType,
  requiredRole: Role,
  getEntityId?: (c: Context) => string | null
): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const userId = getUserId(c)
    if (!userId) {
      logger.warn('Access denied: No user ID in context')
      return c.json({ error: 'Authentication required' }, 401)
    }

    const entityId = getEntityId ? getEntityId(c) : c.req.param('id')
    if (!entityId) {
      logger.warn('Access denied: No entity ID found')
      return c.json({ error: 'Resource ID required' }, 400)
    }

    const hasAccess = await hasAccessToResource(sql, userId, entityType, entityId, requiredRole)
    if (!hasAccess) {
      logger.warn(`Access denied: User ${userId} lacks ${requiredRole} access to ${entityType} ${entityId}`)
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    await next()
  }
}

/**
 * Convenience middleware for common access patterns
 */
export const accessControl = (sql: Sql) => ({
  /**
   * Require developer access to project (can read/write)
   */
  projectDeveloper: (getProjectId?: (c: Context) => string | null) =>
    requireProjectAccess(sql, 'developer', getProjectId),

  /**
   * Require admin access to project (can manage resources)
   */
  projectAdmin: (getProjectId?: (c: Context) => string | null) =>
    requireProjectAccess(sql, 'admin', getProjectId),

  /**
   * Require owner access to project (full control)
   */
  projectOwner: (getProjectId?: (c: Context) => string | null) =>
    requireProjectAccess(sql, 'owner', getProjectId),

  /**
   * Require viewer access to project (read-only)
   */
  projectViewer: (getProjectId?: (c: Context) => string | null) =>
    requireProjectAccess(sql, 'viewer', getProjectId),

  /**
   * Require read access to secret
   */
  secretRead: (getSecretId?: (c: Context) => string | null) =>
    requireResourceAccess(sql, 'secret', 'read', getSecretId),

  /**
   * Require use access to secret (can use in pipelines)
   */
  secretUse: (getSecretId?: (c: Context) => string | null) =>
    requireResourceAccess(sql, 'secret', 'use', getSecretId),

  /**
   * Require write access to task source
   */
  taskSourceWrite: (getTaskSourceId?: (c: Context) => string | null) =>
    requireResourceAccess(sql, 'task_source', 'write', getTaskSourceId),

  /**
   * Require write access to file space
   */
  fileSpaceWrite: (getFileSpaceId?: (c: Context) => string | null) =>
    requireResourceAccess(sql, 'file_space', 'write', getFileSpaceId),
})
