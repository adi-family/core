import type { Sql } from 'postgres'
import type { Message, CreateMessageInput, Result } from '../types'

export const findAllMessages = (sql: Sql) => async (): Promise<Message[]> =>
  await sql<Message[]>`SELECT * FROM messages ORDER BY created_at DESC`

export const findMessagesBySessionId = (sql: Sql) => async (sessionId: string): Promise<Message[]> =>
  await sql<Message[]>`SELECT * FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC`

export const findMessageById = (sql: Sql) => async (id: string): Promise<Result<Message>> => {
  const [message] = await sql<Message[]>`SELECT * FROM messages WHERE id = ${id}`
  return message
    ? { ok: true, data: message }
    : { ok: false, error: 'Message not found' }
}

export const createMessage = (sql: Sql) => async (input: CreateMessageInput): Promise<Message> => {
  const [message] = await sql<Message[]>`
    INSERT INTO messages ${sql(input, 'session_id', 'data')}
    RETURNING *
  `
  return message
}

export const deleteMessage = (sql: Sql) => async (id: string): Promise<Result<void>> => {
  const result = await sql`DELETE FROM messages WHERE id = ${id}`
  return result.count > 0
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Message not found' }
}
