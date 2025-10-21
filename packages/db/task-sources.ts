import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { TaskSource, CreateTaskSourceInput, UpdateTaskSourceInput, Result } from '@types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllTaskSources = async (sql: Sql): Promise<TaskSource[]> => {
  return get(sql<TaskSource[]>`SELECT * FROM task_sources ORDER BY created_at DESC`)
}

export const findTaskSourceById = async (sql: Sql, id: string): Promise<Result<TaskSource>> => {
  const taskSources = await get(sql<TaskSource[]>`SELECT * FROM task_sources WHERE id = ${id}`)
  const [taskSource] = taskSources
  return taskSource
    ? { ok: true, data: taskSource }
    : { ok: false, error: 'Task source not found' }
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

const createTaskSourceCols = ['project_id', 'name', 'type', 'config', 'enabled'] as const
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

const updateTaskSourceCols = ['project_id', 'name', 'type', 'config', 'enabled'] as const
export const updateTaskSource = async (sql: Sql, id: string, input: UpdateTaskSourceInput): Promise<Result<TaskSource>> => {
  const taskSources = await get(sql<TaskSource[]>`
    UPDATE task_sources
    SET ${sql(input, updateTaskSourceCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [taskSource] = taskSources
  return taskSource
    ? { ok: true, data: taskSource }
    : { ok: false, error: 'Task source not found' }
}

export const deleteTaskSource = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM task_sources WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Task source not found' }
}

/**
 * Update task source sync status
 */
export const updateTaskSourceSyncStatus = async (
  sql: Sql,
  id: string,
  status: 'pending' | 'syncing' | 'completed' | 'failed',
  lastSyncedAt?: Date
): Promise<Result<TaskSource>> => {
  const updates: Record<string, unknown> = { sync_status: status }
  if (lastSyncedAt) {
    updates.last_synced_at = lastSyncedAt.toISOString()
  }

  const taskSources = await get(sql<TaskSource[]>`
    UPDATE task_sources
    SET ${sql(updates)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [taskSource] = taskSources
  return taskSource
    ? { ok: true, data: taskSource }
    : { ok: false, error: 'Task source not found' }
}
