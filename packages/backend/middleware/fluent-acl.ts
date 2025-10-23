import type { Context } from 'hono'
import type { Sql } from 'postgres'
import type { EntityType, Role } from '../../db/user-access'
import { hasProjectAccess, hasAccessToResource } from '../../db/user-access'
import { getClerkUserId } from './clerk'
import { isServiceAuthenticated } from './service-auth'

/**
 * Fluent API for access control
 * Usage:
 *   const userId = acl.project(projectId).admin.gte.throw(c)
 *   const userId = acl.project(projectId).viewer.gte.orNull(c)
 *   const hasAccess = await acl.secret(secretId).read.check(c)
 */

class AccessDeniedError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 403) {
    super(message)
    this.name = 'AccessDeniedError'
    this.statusCode = statusCode
  }
}

class ProjectAccessCheck {
  readonly sql: Sql
  readonly projectId: string
  readonly minRole: Role

  constructor(sql: Sql, projectId: string, minRole: Role) {
    this.sql = sql
    this.projectId = projectId
    this.minRole = minRole
  }

  /**
   * Check if user has access
   * Returns userId if has access, throws 401/403 if not
   * Internal service calls (API_TOKEN) bypass ACL checks
   */
  async throw(c: Context): Promise<string> {
    // Internal service calls bypass ACL checks
    if (isServiceAuthenticated(c)) {
      return 'service' // Return special marker for service calls
    }

    const userId = getClerkUserId(c)

    if (!userId) {
      throw new AccessDeniedError('Authentication required', 401)
    }

    const hasAccess = await hasProjectAccess(this.sql, userId, this.projectId, this.minRole)

    if (!hasAccess) {
      throw new AccessDeniedError(`Requires ${this.minRole} access to project`, 403)
    }

    return userId
  }

  /**
   * Check if user has access
   * Returns userId if has access, null if not
   */
  async orNull(c: Context): Promise<string | null> {
    const userId = getClerkUserId(c)

    if (!userId) {
      return null
    }

    const hasAccess = await hasProjectAccess(this.sql, userId, this.projectId, this.minRole)

    return hasAccess ? userId : null
  }

  /**
   * Check if user has access (boolean)
   */
  async check(c: Context): Promise<boolean> {
    const userId = getClerkUserId(c)

    if (!userId) {
      return false
    }

    return hasProjectAccess(this.sql, userId, this.projectId, this.minRole)
  }
}

class ResourceAccessCheck {
  readonly sql: Sql
  readonly entityType: EntityType
  readonly entityId: string
  readonly role: Role

  constructor(sql: Sql, entityType: EntityType, entityId: string, role: Role) {
    this.sql = sql
    this.entityType = entityType
    this.entityId = entityId
    this.role = role
  }

  /**
   * Check if user has access
   * Returns userId if has access, throws 401/403 if not
   * Internal service calls (API_TOKEN) bypass ACL checks
   */
  async throw(c: Context): Promise<string> {
    // Internal service calls bypass ACL checks
    if (isServiceAuthenticated(c)) {
      return 'service' // Return special marker for service calls
    }

    const userId = getClerkUserId(c)

    if (!userId) {
      throw new AccessDeniedError('Authentication required', 401)
    }

    const hasAccess = await hasAccessToResource(this.sql, userId, this.entityType, this.entityId, this.role)

    if (!hasAccess) {
      throw new AccessDeniedError(`Requires ${this.role} access to ${this.entityType}`, 403)
    }

    return userId
  }

  /**
   * Check if user has access
   * Returns userId if has access, null if not
   */
  async orNull(c: Context): Promise<string | null> {
    const userId = getClerkUserId(c)

    if (!userId) {
      return null
    }

    const hasAccess = await hasAccessToResource(this.sql, userId, this.entityType, this.entityId, this.role)

    return hasAccess ? userId : null
  }

  /**
   * Check if user has access (boolean)
   */
  async check(c: Context): Promise<boolean> {
    const userId = getClerkUserId(c)

    if (!userId) {
      return false
    }

    return hasAccessToResource(this.sql, userId, this.entityType, this.entityId, this.role)
  }
}

class ProjectRoleBuilder {
  readonly sql: Sql
  readonly projectId: string

  constructor(sql: Sql, projectId: string) {
    this.sql = sql
    this.projectId = projectId
  }

  get owner() {
    return {
      gte: new ProjectAccessCheck(this.sql, this.projectId, 'owner')
    }
  }

  get admin() {
    return {
      gte: new ProjectAccessCheck(this.sql, this.projectId, 'admin')
    }
  }

  get developer() {
    return {
      gte: new ProjectAccessCheck(this.sql, this.projectId, 'developer')
    }
  }

  get viewer() {
    return {
      gte: new ProjectAccessCheck(this.sql, this.projectId, 'viewer')
    }
  }
}

class ResourceRoleBuilder {
  readonly sql: Sql
  readonly entityType: EntityType
  readonly entityId: string

  constructor(sql: Sql, entityType: EntityType, entityId: string) {
    this.sql = sql
    this.entityType = entityType
    this.entityId = entityId
  }

  get read() {
    return new ResourceAccessCheck(this.sql, this.entityType, this.entityId, 'read')
  }

  get write() {
    return new ResourceAccessCheck(this.sql, this.entityType, this.entityId, 'write')
  }

  get use() {
    return new ResourceAccessCheck(this.sql, this.entityType, this.entityId, 'use')
  }
}

/**
 * Fluent ACL builder
 */
export class FluentACL {
  readonly sql: Sql

  constructor(sql: Sql) {
    this.sql = sql
  }

  /**
   * Project-level access control
   * @example
   *   const userId = await acl.project(projectId).admin.gte.throw(c)
   *   const userId = await acl.project(projectId).viewer.gte.orNull(c)
   *   const hasAccess = await acl.project(projectId).developer.gte.check(c)
   */
  project(projectId: string) {
    return new ProjectRoleBuilder(this.sql, projectId)
  }

  /**
   * Secret access control
   * @example
   *   const userId = await acl.secret(secretId).read.throw(c)
   *   const userId = await acl.secret(secretId).use.orNull(c)
   */
  secret(secretId: string) {
    return new ResourceRoleBuilder(this.sql, 'secret', secretId)
  }

  /**
   * Task source access control
   * @example
   *   const userId = await acl.taskSource(id).write.throw(c)
   */
  taskSource(taskSourceId: string) {
    return new ResourceRoleBuilder(this.sql, 'task_source', taskSourceId)
  }

  /**
   * File space access control
   * @example
   *   const userId = await acl.fileSpace(id).write.throw(c)
   */
  fileSpace(fileSpaceId: string) {
    return new ResourceRoleBuilder(this.sql, 'file_space', fileSpaceId)
  }

  /**
   * Task access control
   * @example
   *   const userId = await acl.task(id).read.throw(c)
   */
  task(taskId: string) {
    return new ResourceRoleBuilder(this.sql, 'task', taskId)
  }
}

/**
 * Create fluent ACL instance
 */
export const createFluentACL = (sql: Sql) => new FluentACL(sql)

/**
 * Export error for catching in handlers
 */
export { AccessDeniedError }
