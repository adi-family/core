import type { MaybeRow, PendingQuery, Sql } from 'postgres'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v)
}

export interface TaskSourceSyncState {
  task_source_id: string
  issue_id: string
  issue_updated_at: string
  last_seen_at: string
}

export interface UpsertSyncStateInput {
  task_source_id: string
  issue_id: string
  issue_updated_at: string
}

/**
 * Get all sync state entries for a task source
 */
export const findSyncStateByTaskSourceId = async (
  sql: Sql,
  taskSourceId: string
): Promise<TaskSourceSyncState[]> => {
  return get(sql<TaskSourceSyncState[]>`
    SELECT * FROM task_source_sync_state
    WHERE task_source_id = ${taskSourceId}
    ORDER BY last_seen_at DESC
  `)
}

/**
 * Get sync state for a specific issue
 */
export const findSyncStateByIssueId = async (
  sql: Sql,
  taskSourceId: string,
  issueId: string
): Promise<TaskSourceSyncState | null> => {
  const [state] = await get(sql<TaskSourceSyncState[]>`
    SELECT * FROM task_source_sync_state
    WHERE task_source_id = ${taskSourceId}
      AND issue_id = ${issueId}
  `)
  return state || null
}

/**
 * Upsert sync state for an issue
 * Updates last_seen_at and issue_updated_at
 */
export const upsertSyncState = async (
  sql: Sql,
  input: UpsertSyncStateInput
): Promise<TaskSourceSyncState> => {
  const [state] = await get(sql<TaskSourceSyncState[]>`
    INSERT INTO task_source_sync_state (task_source_id, issue_id, issue_updated_at, last_seen_at)
    VALUES (${input.task_source_id}, ${input.issue_id}, ${input.issue_updated_at}, NOW())
    ON CONFLICT (task_source_id, issue_id)
    DO UPDATE SET
      issue_updated_at = EXCLUDED.issue_updated_at,
      last_seen_at = NOW()
    RETURNING *
  `)
  if (!state) {
    throw new Error('Failed to upsert sync state')
  }
  return state
}

/**
 * Batch upsert sync states
 */
export const batchUpsertSyncStates = async (
  sql: Sql,
  states: UpsertSyncStateInput[]
): Promise<void> => {
  if (states.length === 0) return

  // Process each state individually to avoid CSV formatting issues
  for (const state of states) {
    await sql`
      INSERT INTO task_source_sync_state (task_source_id, issue_id, issue_updated_at, last_seen_at)
      VALUES (${state.task_source_id}, ${state.issue_id}, ${state.issue_updated_at}, NOW())
      ON CONFLICT (task_source_id, issue_id)
      DO UPDATE SET
        issue_updated_at = EXCLUDED.issue_updated_at,
        last_seen_at = NOW()
    `
  }
}

/**
 * Find stale issues (not seen in current sync)
 * Returns issue IDs that were seen before the given timestamp
 */
export const findStaleIssues = async (
  sql: Sql,
  taskSourceId: string,
  beforeTimestamp: Date
): Promise<string[]> => {
  const results = await get(sql<{ issue_id: string }[]>`
    SELECT issue_id FROM task_source_sync_state
    WHERE task_source_id = ${taskSourceId}
      AND last_seen_at < ${beforeTimestamp.toISOString()}
  `)
  return results.map(r => r.issue_id)
}

/**
 * Delete sync state entries
 */
export const deleteSyncState = async (
  sql: Sql,
  taskSourceId: string,
  issueId: string
): Promise<void> => {
  await get(sql`
    DELETE FROM task_source_sync_state
    WHERE task_source_id = ${taskSourceId}
      AND issue_id = ${issueId}
  `)
}

/**
 * Delete all sync state for a task source
 */
export const deleteAllSyncState = async (
  sql: Sql,
  taskSourceId: string
): Promise<void> => {
  await get(sql`
    DELETE FROM task_source_sync_state
    WHERE task_source_id = ${taskSourceId}
  `)
}
