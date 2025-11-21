import type { Sql } from 'postgres'
import type { Session, CreateSessionInput } from '@types'
import { get, findOneById, deleteById } from './utils'
import { NotFoundException } from '../utils/exceptions'

export const findAllSessions = async (sql: Sql): Promise<Session[]> => {
  return get(sql<Session[]>`SELECT * FROM sessions ORDER BY created_at DESC`)
}

export const findSessionById = async (sql: Sql, id: string): Promise<Session> => {
  return findOneById<Session>(sql, 'sessions', id, 'Session')
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
  return deleteById(sql, 'sessions', id, 'Session')
}

export interface UpdateSessionInput {
  worker_type_override?: string | null
  executed_by_worker_type?: string | null
}

export const updateSession = async (sql: Sql, id: string, input: UpdateSessionInput): Promise<Session> => {
  const [session] = await get(sql<Session[]>`
    UPDATE sessions
    SET
      worker_type_override = COALESCE(${input.worker_type_override ?? null}, worker_type_override),
      executed_by_worker_type = COALESCE(${input.executed_by_worker_type ?? null}, executed_by_worker_type),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  if (!session) {
    throw new NotFoundException('Session not found')
  }
  return session
}
