import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { UserAccess, CreateUserAccessInput, Result } from '@types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export type EntityType = 'project' | 'task_source' | 'file_space' | 'secret' | 'task'
export type Role = 'owner' | 'admin' | 'developer' | 'viewer' | 'read' | 'write' | 'use'

// Project-level roles in order of permission hierarchy
const PROJECT_ROLES: Role[] = ['owner', 'admin', 'developer', 'viewer']

export const findUserAccess = async (
  sql: Sql,
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<UserAccess[]> => {
  return get(sql<UserAccess[]>`
    SELECT * FROM user_access
    WHERE user_id = ${userId}
    AND entity_type = ${entityType}
    AND entity_id = ${entityId}
    AND (expires_at IS NULL OR expires_at > NOW())
  `)
}

export const findAllUserAccessForEntity = async (
  sql: Sql,
  entityType: EntityType,
  entityId: string
): Promise<UserAccess[]> => {
  return get(sql<UserAccess[]>`
    SELECT * FROM user_access
    WHERE entity_type = ${entityType}
    AND entity_id = ${entityId}
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
  `)
}

/**
 * Get project owner user ID
 * Returns the first owner found, or null if no owner exists
 */
export const getProjectOwnerId = async (
  sql: Sql,
  projectId: string
): Promise<string | null> => {
  const accesses = await get(sql<UserAccess[]>`
    SELECT * FROM user_access
    WHERE entity_type = 'project'
    AND entity_id = ${projectId}
    AND role = 'owner'
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at ASC
    LIMIT 1
  `)

  return accesses.length > 0 && accesses[0] ? accesses[0].user_id : null
}

export const findAllUserAccessForUser = async (
  sql: Sql,
  userId: string
): Promise<UserAccess[]> => {
  return get(sql<UserAccess[]>`
    SELECT * FROM user_access
    WHERE user_id = ${userId}
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
  `)
}

export const hasProjectAccess = async (
  sql: Sql,
  userId: string,
  projectId: string,
  minRole: Role = 'viewer'
): Promise<boolean> => {
  const minRoleIndex = PROJECT_ROLES.indexOf(minRole)
  if (minRoleIndex === -1) {
    throw new Error(`Invalid project role: ${minRole}`)
  }

  const allowedRoles = PROJECT_ROLES.slice(0, minRoleIndex + 1)

  const [result] = await get(sql<[{ exists: boolean }]>`
    SELECT EXISTS(
      SELECT 1 FROM user_access
      WHERE user_id = ${userId}
      AND entity_type = 'project'
      AND entity_id = ${projectId}
      AND role = ANY(${allowedRoles})
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  `)

  return result?.exists ?? false
}

export const hasResourceAccess = async (
  sql: Sql,
  userId: string,
  entityType: EntityType,
  entityId: string,
  requiredRole: Role
): Promise<boolean> => {
  const [result] = await get(sql<[{ exists: boolean }]>`
    SELECT EXISTS(
      SELECT 1 FROM user_access
      WHERE user_id = ${userId}
      AND entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND role = ${requiredRole}
      AND (expires_at IS NULL OR expires_at > NOW())
    )
  `)

  return result?.exists ?? false
}

export const hasAccessToResource = async (
  sql: Sql,
  userId: string,
  entityType: EntityType,
  entityId: string,
  requiredRole: Role
): Promise<boolean> => {
  // Validate requiredRole is defined
  if (!requiredRole) {
    console.warn('[hasAccessToResource] requiredRole is undefined', { entityType, entityId, userId })
    return false
  }

  // First check direct resource access
  const directAccess = await hasResourceAccess(sql, userId, entityType, entityId, requiredRole)
  if (directAccess) {
    return true
  }

  // For non-project entities, check if user has project-level access
  if (entityType !== 'project') {
    const projectId = await getProjectIdForEntity(sql, entityType, entityId)
    if (projectId) {
      // Map resource role to minimum required project role
      const minProjectRole = mapResourceRoleToProjectRole(requiredRole)
      if (!minProjectRole) {
        console.warn('[hasAccessToResource] minProjectRole is undefined after mapping', { requiredRole, entityType, entityId })
        return false
      }
      return hasProjectAccess(sql, userId, projectId, minProjectRole)
    }
  }

  return false
}

const getProjectIdForEntity = async (
  sql: Sql,
  entityType: EntityType,
  entityId: string
): Promise<string | null> => {
  if (entityType === 'task_source') {
    const [result] = await get(sql<[{ project_id: string }]>`
      SELECT project_id FROM task_sources WHERE id = ${entityId}
    `)
    return result?.project_id ?? null
  }

  if (entityType === 'file_space') {
    const [result] = await get(sql<[{ project_id: string }]>`
      SELECT project_id FROM file_spaces WHERE id = ${entityId}
    `)
    return result?.project_id ?? null
  }

  if (entityType === 'secret') {
    const [result] = await get(sql<[{ project_id: string }]>`
      SELECT project_id FROM secrets WHERE id = ${entityId}
    `)
    return result?.project_id ?? null
  }

  if (entityType === 'task') {
    const [task] = await get(sql<[{ task_source_id: string }]>`
      SELECT task_source_id FROM tasks WHERE id = ${entityId}
    `)
    if (task?.task_source_id) {
      const [taskSource] = await get(sql<[{ project_id: string }]>`
        SELECT project_id FROM task_sources WHERE id = ${task.task_source_id}
      `)
      return taskSource?.project_id ?? null
    }
  }

  return null
}

const mapResourceRoleToProjectRole = (role: Role): Role => {
  switch (role) {
    case 'read':
      return 'viewer'
    case 'write':
    case 'use':
      return 'developer'
    default:
      return role
  }
}

const createUserAccessCols = ['user_id', 'entity_type', 'entity_id', 'role', 'granted_by'] as const
export const grantAccess = async (
  sql: Sql,
  input: CreateUserAccessInput
): Promise<UserAccess> => {
  const [access] = await get(sql<UserAccess[]>`
    INSERT INTO user_access ${sql(input, createUserAccessCols)}
    ON CONFLICT (user_id, entity_type, entity_id, role) DO UPDATE
    SET granted_by = EXCLUDED.granted_by,
        granted_at = NOW()
    RETURNING *
  `)
  if (!access) {
    throw new Error('Failed to grant access')
  }
  return access
}

export const revokeAccess = async (
  sql: Sql,
  userId: string,
  entityType: EntityType,
  entityId: string,
  role?: Role
): Promise<Result<void>> => {
  const resultSet = role
    ? await get(sql`
        DELETE FROM user_access
        WHERE user_id = ${userId}
        AND entity_type = ${entityType}
        AND entity_id = ${entityId}
        AND role = ${role}
      `)
    : await get(sql`
        DELETE FROM user_access
        WHERE user_id = ${userId}
        AND entity_type = ${entityType}
        AND entity_id = ${entityId}
      `)

  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Access not found' }
}

export const getUserAccessibleProjects = async (
  sql: Sql,
  userId: string
): Promise<string[]> => {
  const results = await get(sql<[{ entity_id: string }]>`
    SELECT DISTINCT entity_id
    FROM user_access
    WHERE user_id = ${userId}
    AND entity_type = 'project'
    AND (expires_at IS NULL OR expires_at > NOW())
  `)
  return results.map(r => r.entity_id)
}

export const cleanupExpiredAccess = async (sql: Sql): Promise<number> => {
  const resultSet = await get(sql`
    DELETE FROM user_access
    WHERE expires_at IS NOT NULL
    AND expires_at <= NOW()
  `)
  return resultSet.count
}
