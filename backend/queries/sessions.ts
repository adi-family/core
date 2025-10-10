import type { Sql } from 'postgres'
import type { Session, CreateSessionInput, Result } from '../types'

export const findAllSessions = (sql: Sql) => async (): Promise<Session[]> =>
  await sql<Session[]>`SELECT * FROM sessions ORDER BY created_at DESC`

export const findSessionById = (sql: Sql) => async (id: string): Promise<Result<Session>> => {
  const [session] = await sql<Session[]>`SELECT * FROM sessions WHERE id = ${id}`
  return session
    ? { ok: true, data: session }
    : { ok: false, error: 'Session not found' }
}

export const findSessionsByTaskId = (sql: Sql) => async (taskId: string): Promise<Session[]> =>
  await sql<Session[]>`SELECT * FROM sessions WHERE task_id = ${taskId} ORDER BY created_at DESC`

export const createSession = (sql: Sql) => async (input: CreateSessionInput): Promise<Session> => {
  const [session] = await sql<Session[]>`
    INSERT INTO sessions ${sql(input, 'task_id', 'runner')}
    RETURNING *
  `
  return session
}

export const deleteSession = (sql: Sql) => async (id: string): Promise<Result<void>> => {
  const result = await sql`DELETE FROM sessions WHERE id = ${id}`
  return result.count > 0
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Session not found' }
}
