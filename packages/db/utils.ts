import type { MaybeRow, PendingQuery, Sql } from 'postgres'
import { NotFoundException } from '../utils/exceptions'

/**
 * Helper function to resolve a postgres PendingQuery
 * This ensures proper typing when working with query results
 */
export function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

/**
 * Generic function to find a single entity by ID
 * @param sql - Postgres connection
 * @param table - Table name (e.g., 'sessions', 'tasks', 'projects')
 * @param id - The ID to search for
 * @param entityName - Human-readable entity name for error messages (e.g., 'Session', 'Task')
 * @returns The found entity
 * @throws NotFoundException if entity not found
 */
export async function findOneById<T>(
  sql: Sql,
  table: string,
  id: string,
  entityName: string
): Promise<T> {
  const results = await get(sql.unsafe(`SELECT * FROM ${table} WHERE id = $1`, [id]) as any)
  const [entity] = results
  if (!entity) {
    throw new NotFoundException(`${entityName} not found`)
  }
  return entity as T
}

/**
 * Generic function to delete a single entity by ID
 * @param sql - Postgres connection
 * @param table - Table name (e.g., 'sessions', 'tasks', 'projects')
 * @param id - The ID to delete
 * @param entityName - Human-readable entity name for error messages (e.g., 'Session', 'Task')
 * @throws NotFoundException if entity not found
 */
export async function deleteById(
  sql: Sql,
  table: string,
  id: string,
  entityName: string
): Promise<void> {
  const resultSet = await get(sql.unsafe(`DELETE FROM ${table} WHERE id = $1`, [id]) as any)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException(`${entityName} not found`)
  }
}

/**
 * Filter columns to only include those present in the input object
 * This prevents postgres from throwing UNDEFINED_VALUE errors when updating with partial data
 */
export function filterPresentColumns<T extends readonly string[]>(
  input: Record<string, unknown>,
  columns: T
): T[number][] {
  return columns.filter(col => col in input) as T[number][]
}
