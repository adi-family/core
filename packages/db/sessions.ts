import type { MaybeRow, PendingQuery, Sql } from 'postgres'
import type { Session, CreateSessionInput } from '@types'
import { NotFoundException } from '../utils/exceptions'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllSessions = async (sql: Sql): Promise<Session[]> => {
  return get(sql<Session[]>`SELECT * FROM sessions ORDER BY created_at DESC`)
}

export const findSessionById = async (sql: Sql, id: string): Promise<Session> => {
  const sessions = await get(sql<Session[]>`SELECT * FROM sessions WHERE id = ${id}`)
  const [session] = sessions
  if (!session) {
    throw new NotFoundException('Session not found')
  }
  return session
}

export const findSessionsByTaskId = async (sql: Sql, taskId: string): Promise<Session[]> => {
  return get(sql<Session[]>`SELECT * FROM sessions WHERE task_id = ${taskId} ORDER BY created_at DESC`)
}

const createSessionCols = ['task_id', 'runner'] as const
export const createSession = async (sql: Sql, input: CreateSessionInput): Promise<Session> => {
  const [session] = await get(sql<Session[]>`
    INSERT INTO sessions ${sql(input, createSessionCols)}
    RETURNING *
  `)
  if (!session) {
    throw new Error('Failed to create session')
  }
  return session
}

export const deleteSession = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM sessions WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('Session not found')
  }
}

export interface UpdateSessionInput {
  worker_type_override?: string | null
  executed_by_worker_type?: string | null
}

export const updateSession = async (sql: Sql, id: string, input: UpdateSessionInput): Promise<Session> => {
  const [session] = await get(sql<Session[]>`
    UPDATE sessions
    SET
      worker_type_override = COALESCE(${input.worker_type_override}, worker_type_override),
      executed_by_worker_type = COALESCE(${input.executed_by_worker_type}, executed_by_worker_type),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  if (!session) {
    throw new NotFoundException('Session not found')
  }
  return session
}
