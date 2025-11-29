/**
 * ACL (Access Control Layer) - Sequential API for mandatory access checks
 *
 * Usage:
 *   await acl.project(id).viewer()
 *   const project = await getProject(sql, id)
 */

import type { Sql } from 'postgres'
import { NotEnoughRightsException } from '../utils/exceptions'
import { hasProjectAccess, hasAdminAccess, getUserAccessibleProjects } from './user-access'

type ProjectRole = 'owner' | 'admin' | 'developer' | 'viewer'

interface AclContext {
  userId: string
  sql: Sql
}

/**
 * Project-level ACL checker
 */
const createProjectAcl = (ctx: AclContext, projectId: string) => {
  const checkRole = async (minRole: ProjectRole): Promise<void> => {
    const hasAccess = await hasProjectAccess(ctx.sql, ctx.userId, projectId, minRole)
    if (!hasAccess) {
      throw new NotEnoughRightsException(`Forbidden: Requires ${minRole} access to project`)
    }
  }

  return {
    /** Requires viewer role or higher */
    viewer: () => checkRole('viewer'),
    /** Requires developer role or higher */
    developer: () => checkRole('developer'),
    /** Requires admin role or higher */
    admin: () => checkRole('admin'),
    /** Requires owner role */
    owner: () => checkRole('owner'),
  }
}

/**
 * Multi-project ACL checker
 */
const createProjectsAcl = (ctx: AclContext, projectIds: string[]) => {
  const checkRole = async (minRole: ProjectRole): Promise<void> => {
    for (const projectId of projectIds) {
      const hasAccess = await hasProjectAccess(ctx.sql, ctx.userId, projectId, minRole)
      if (!hasAccess) {
        throw new NotEnoughRightsException(`Forbidden: Requires ${minRole} access to project`)
      }
    }
  }

  return {
    viewer: () => checkRole('viewer'),
    developer: () => checkRole('developer'),
    admin: () => checkRole('admin'),
    owner: () => checkRole('owner'),
  }
}

/**
 * Main ACL builder
 */
export interface Acl {
  /** Check access to a single project */
  project: (id: string) => {
    viewer: () => Promise<void>
    developer: () => Promise<void>
    admin: () => Promise<void>
    owner: () => Promise<void>
  }
  /** Check access to multiple projects */
  projects: (ids: string[]) => {
    viewer: () => Promise<void>
    developer: () => Promise<void>
    admin: () => Promise<void>
    owner: () => Promise<void>
  }
  /** Check if user is admin of any project */
  isAdmin: () => Promise<void>
  /** Get list of project IDs user has access to */
  accessibleProjectIds: () => Promise<string[]>
}

/**
 * Create ACL instance for a user
 *
 * @example
 * // Single project check
 * await acl.project(projectId).viewer()
 * const project = await queries.findProjectById(sql, projectId)
 *
 * // Admin check
 * await acl.project(projectId).admin()
 * await queries.updateProject(sql, projectId, updates)
 *
 * // List accessible projects
 * const ids = await acl.accessibleProjectIds()
 * const projects = await queries.findProjectsByIds(sql, ids)
 */
export const createAcl = (ctx: AclContext): Acl => ({
  project: (id: string) => createProjectAcl(ctx, id),
  projects: (ids: string[]) => createProjectsAcl(ctx, ids),

  isAdmin: async () => {
    const isAdmin = await hasAdminAccess(ctx.sql, ctx.userId)
    if (!isAdmin) {
      throw new NotEnoughRightsException('Forbidden: Admin access required')
    }
  },

  accessibleProjectIds: () => getUserAccessibleProjects(ctx.sql, ctx.userId),
})

export type { AclContext, ProjectRole }
