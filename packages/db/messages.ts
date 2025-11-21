import type { Sql } from 'postgres'
import type { Message, CreateMessageInput } from '@types'
import { get, findOneById } from './utils'

export const findAllMessages = async (sql: Sql): Promise<Message[]> => {
  return get(sql<Message[]>`SELECT * FROM messages ORDER BY created_at DESC`);
}

export const findMessagesBySessionId = async (sql: Sql, sessionId: string): Promise<Message[]> => {
  return get(sql<Message[]>`SELECT * FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC`)
}

export const findMessageById = async (sql: Sql, id: string): Promise<Message> => {
  return findOneById<Message>(sql, 'messages', id, 'Message')
}

const createMessageCols = ['session_id', 'data'] as const
export const createMessage = async (sql: Sql, input: CreateMessageInput): Promise<Message> => {
  const [message] = await get(sql<Message[]>`
    INSERT INTO messages ${sql(input, createMessageCols)}
    RETURNING *
  `)
  if (!message) {
    throw new Error('Failed to create message')
  }
  return message
}

export const deleteMessage = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM messages WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('Message not found')
  }
}
