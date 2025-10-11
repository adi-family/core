import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Message, CreateMessageInput, Result } from '../types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllMessages = async (sql: Sql): Promise<Message[]> => {
  return get(sql<Message[]>`SELECT * FROM messages ORDER BY created_at DESC`);
}

export const findMessagesBySessionId = (sql: Sql) => async (sessionId: string): Promise<Message[]> => {
  return get(sql<Message[]>`SELECT * FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC`)
}

export const findMessageById = (sql: Sql) => async (id: string): Promise<Result<Message>> => {
  const messages = await get(sql<Message[]>`SELECT * FROM messages WHERE id = ${id}`)
  const [message] = messages
  return message
    ? { ok: true, data: message }
    : { ok: false, error: 'Message not found' }
}

export const createMessage = (sql: Sql) => async (input: CreateMessageInput): Promise<Message> => {
  const messages = await get(sql<Message[]>`
    INSERT INTO messages ${sql(input, 'session_id', 'data')}
    RETURNING *
  `)
  const [message] = messages
  return message
}

export const deleteMessage = (sql: Sql) => async (id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM messages WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Message not found' }
}
