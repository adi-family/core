import type { Sql } from 'postgres'
import type { TaskSource, CreateTaskSourceInput, UpdateTaskSourceInput } from '@types'
import { filterPresentColumns, get, findOneById } from './utils'

export const findAllTaskSources = async (sql: Sql): Promise<TaskSource[]> => {
  return get(sql<TaskSource[]>`SELECT * FROM task_sources ORDER BY created_at DESC`)
}

export const findTaskSourceById = async (sql: Sql, id: string): Promise<TaskSource> => {
  return findOneById<TaskSource>(sql, 'task_sources', id, 'Task source')
}

export const findTaskSourcesByProjectId = async (sql: Sql, projectId: string): Promise<TaskSource[]> => {
  return get(sql<TaskSource[]>`SELECT * FROM task_sources WHERE project_id = ${projectId} ORDER BY created_at DESC`)
}

export const findTaskSourcesByProjectIds = async (sql: Sql, projectIds: string[]): Promise<Map<string, TaskSource[]>> => {
  if (projectIds.length === 0) {
    return new Map()
  }

  const taskSources = await get(sql<TaskSource[]>`
    SELECT * FROM task_sources
    WHERE project_id = ANY(${projectIds}) AND enabled = true
    ORDER BY created_at ASC
  `)

  const grouped = new Map<string, TaskSource[]>()
  for (const ts of taskSources) {
    const existing = grouped.get(ts.project_id) || []
    existing.push(ts)
    grouped.set(ts.project_id, existing)
  }

  return grouped
}

/**
 * Find or create manual task source for a project
 * Manual task sources are automatically created when needed
 */
export const findOrCreateManualTaskSource = async (sql: Sql, projectId: string): Promise<TaskSource> => {
  // Try to find existing manual task source
  const taskSources = await get(sql<TaskSource[]>`
    SELECT * FROM task_sources
    WHERE project_id = ${projectId} AND type = 'manual'
    LIMIT 1
  `)

  if (taskSources.length > 0 && taskSources[0]) {
    return taskSources[0]
  }

  // Create manual task source if it doesn't exist
  const [manualSource] = await get(sql<TaskSource[]>`
    INSERT INTO task_sources (project_id, name, type, config, enabled, auto_evaluate)
    VALUES (${projectId}, 'Manual Tasks', 'manual', '{}'::jsonb, true, true)
    RETURNING *
  `)

  if (!manualSource) {
    throw new Error('Failed to create manual task source')
  }

  return manualSource
}

const createTaskSourceCols = ['project_id', 'name', 'type', 'config', 'enabled', 'auto_evaluate'] as const
export const createTaskSource = async (sql: Sql, input: CreateTaskSourceInput): Promise<TaskSource> => {
  const [taskSource] = await get(sql<TaskSource[]>`
    INSERT INTO task_sources ${sql(input, createTaskSourceCols)}
    RETURNING *
  `)
  if (!taskSource) {
    throw new Error('Failed to create task source')
  }
  return taskSource
}

const updateTaskSourceCols = ['project_id', 'name', 'type', 'config', 'enabled', 'auto_evaluate'] as const
export const updateTaskSource = async (sql: Sql, id: string, input: UpdateTaskSourceInput): Promise<TaskSource> => {
  const presentCols = filterPresentColumns(input, updateTaskSourceCols)

  const taskSources = await get(sql<TaskSource[]>`
    UPDATE task_sources
    SET ${sql(input, presentCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [taskSource] = taskSources
  if (!taskSource) {
    throw new NotFoundException('Task source not found')
  }
  return taskSource
}

export const deleteTaskSource = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM task_sources WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('Task source not found')
  }
}

/**
 * Find task sources that need syncing
 * Returns enabled task sources that haven't been synced in the last N minutes
 * Also includes task sources stuck in 'queued' or 'syncing' status for too long
 */
export const findTaskSourcesNeedingSync = async (
  sql: Sql,
  minutesSinceLastSync: number,
  queuedTimeoutMinutes = 120
): Promise<TaskSource[]> => {
  return get(sql<TaskSource[]>`
    SELECT * FROM task_sources
    WHERE enabled = true
      AND (
        -- Normal case: never synced or synced long ago
        (
          (last_synced_at IS NULL OR last_synced_at < NOW() - (${minutesSinceLastSync}::text || ' minutes')::interval)
          AND sync_status NOT IN ('syncing', 'queued')
        )
        -- Corner case: stuck in 'queued' status for too long
        OR (
          sync_status = 'queued'
          AND updated_at < NOW() - (${queuedTimeoutMinutes}::text || ' minutes')::interval
        )
        -- Corner case: stuck in 'syncing' status for too long
        OR (
          sync_status = 'syncing'
          AND updated_at < NOW() - (${queuedTimeoutMinutes}::text || ' minutes')::interval
        )
      )
    ORDER BY
      CASE
        WHEN sync_status IN ('queued', 'syncing') AND updated_at < NOW() - (${queuedTimeoutMinutes}::text || ' minutes')::interval THEN 0
        WHEN last_synced_at IS NULL THEN 1
        ELSE 2
      END,
      updated_at ASC,
      last_synced_at ASC NULLS FIRST
  `)
}

/**
 * Update task source sync status
 */
export const updateTaskSourceSyncStatus = async (
  sql: Sql,
  id: string,
  status: 'pending' | 'queued' | 'syncing' | 'completed' | 'failed',
  lastSyncedAt?: Date
): Promise<TaskSource> => {
  const taskSources = await get(
    lastSyncedAt
      ? sql<TaskSource[]>`
          UPDATE task_sources
          SET sync_status = ${status}, last_synced_at = ${lastSyncedAt.toISOString()}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `
      : sql<TaskSource[]>`
          UPDATE task_sources
          SET sync_status = ${status}, updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `
  )
  const [taskSource] = taskSources
  if (!taskSource) {
    throw new NotFoundException('Task source not found')
  }
  return taskSource
}
