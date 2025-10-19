import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Session, CreateSessionInput, Result } from '../types/index.js'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllSessions = async (sql: Sql): Promise<Session[]> => {
  return get(sql<Session[]>`SELECT * FROM sessions ORDER BY created_at DESC`)
}

export const findSessionById = async (sql: Sql, id: string): Promise<Result<Session>> => {
  const sessions = await get(sql<Session[]>`SELECT * FROM sessions WHERE id = ${id}`)
  const [session] = sessions
  return session
    ? { ok: true, data: session }
    : { ok: false, error: 'Session not found' }
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

export const deleteSession = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM sessions WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Session not found' }
}
