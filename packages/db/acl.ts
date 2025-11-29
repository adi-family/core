/**
 * ACL (Access Control Layer) - Sequential API for mandatory access checks
 *
 * Usage:
 *   await acl.project(id).viewer()
 *   await acl.execution(id).developer()
 */

import type { Sql } from 'postgres'
import { NotEnoughRightsException } from '../utils/exceptions'
import { hasProjectAccess, hasAdminAccess, getUserAccessibleProjects } from './user-access'
import { findPipelineExecutionById } from './pipeline-executions'
import { findSessionById } from './sessions'
import { findTaskById } from './tasks'
import { findSecretById } from './secrets'

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
 * Resolve task to project ID
 */
const resolveTaskToProjectId = async (ctx: AclContext, taskId: string): Promise<string> => {
  const task = await findTaskById(ctx.sql, taskId)
  if (!task.project_id) {
    throw new NotEnoughRightsException('Forbidden: Task not associated with a project')
  }
  return task.project_id
}

/**
 * Resolve session to project ID via chain: session → task → project
 */
const resolveSessionToProjectId = async (ctx: AclContext, sessionId: string): Promise<string> => {
  const session = await findSessionById(ctx.sql, sessionId)
  if (!session.task_id) {
    throw new NotEnoughRightsException('Forbidden: Session not associated with a task')
  }
  return resolveTaskToProjectId(ctx, session.task_id)
}

/**
 * Resolve execution to project ID via chain: execution → session → task → project
 */
const resolveExecutionToProjectId = async (ctx: AclContext, executionId: string): Promise<string> => {
  const execution = await findPipelineExecutionById(ctx.sql, executionId)
  if (!execution.session_id) {
    throw new NotEnoughRightsException('Forbidden: Execution not associated with a session')
  }

  return resolveSessionToProjectId(ctx, execution.session_id)
}

/**
 * Task-level ACL checker (resolves to project)
 */
const createTaskAcl = (ctx: AclContext, taskId: string) => {
  const checkRole = async (minRole: ProjectRole): Promise<void> => {
    const projectId = await resolveTaskToProjectId(ctx, taskId)
    const hasAccess = await hasProjectAccess(ctx.sql, ctx.userId, projectId, minRole)
    if (!hasAccess) {
      throw new NotEnoughRightsException(`Forbidden: Requires ${minRole} access to task's project`)
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
 * Session-level ACL checker (resolves to project via task)
 */
const createSessionAcl = (ctx: AclContext, sessionId: string) => {
  const checkRole = async (minRole: ProjectRole): Promise<void> => {
    const projectId = await resolveSessionToProjectId(ctx, sessionId)
    const hasAccess = await hasProjectAccess(ctx.sql, ctx.userId, projectId, minRole)
    if (!hasAccess) {
      throw new NotEnoughRightsException(`Forbidden: Requires ${minRole} access to session's project`)
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
 * Execution-level ACL checker (resolves to project via session → task)
 */
const createExecutionAcl = (ctx: AclContext, executionId: string) => {
  const checkRole = async (minRole: ProjectRole): Promise<void> => {
    const projectId = await resolveExecutionToProjectId(ctx, executionId)
    const hasAccess = await hasProjectAccess(ctx.sql, ctx.userId, projectId, minRole)
    if (!hasAccess) {
      throw new NotEnoughRightsException(`Forbidden: Requires ${minRole} access to execution's project`)
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
 * Secret-level ACL checker (resolves to project)
 */
const createSecretAcl = (ctx: AclContext, secretId: string) => {
  const checkRole = async (minRole: ProjectRole): Promise<void> => {
    const secret = await findSecretById(ctx.sql, secretId)
    const hasAccess = await hasProjectAccess(ctx.sql, ctx.userId, secret.project_id, minRole)
    if (!hasAccess) {
      throw new NotEnoughRightsException(`Forbidden: Requires ${minRole} access to secret's project`)
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

interface RoleChecker {
  viewer: () => Promise<void>
  developer: () => Promise<void>
  admin: () => Promise<void>
  owner: () => Promise<void>
}

/**
 * Main ACL builder
 */
export interface Acl {
  /** Check access to a single project */
  project: (id: string) => RoleChecker
  /** Check access to multiple projects */
  projects: (ids: string[]) => RoleChecker
  /** Check access via task (resolves: task → project) */
  task: (id: string) => RoleChecker
  /** Check access via session (resolves: session → task → project) */
  session: (id: string) => RoleChecker
  /** Check access via execution (resolves: execution → session → task → project) */
  execution: (id: string) => RoleChecker
  /** Check access via secret (resolves: secret → project) */
  secret: (id: string) => RoleChecker
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
  task: (id: string) => createTaskAcl(ctx, id),
  session: (id: string) => createSessionAcl(ctx, id),
  execution: (id: string) => createExecutionAcl(ctx, id),
  secret: (id: string) => createSecretAcl(ctx, id),

  isAdmin: async () => {
    const isAdmin = await hasAdminAccess(ctx.sql, ctx.userId)
    if (!isAdmin) {
      throw new NotEnoughRightsException('Forbidden: Admin access required')
    }
  },

  accessibleProjectIds: () => getUserAccessibleProjects(ctx.sql, ctx.userId),
})

export type { AclContext, ProjectRole }
