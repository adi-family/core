/**
 * Messages API handlers
 */

import { handler } from '@adi-family/http'
import { listMessagesConfig } from '@adi/api-contracts'
import type { Sql } from 'postgres'

/**
 * Create message handlers
 */
export function createMessageHandlers(sql: Sql) {
  const listMessages = handler(listMessagesConfig, async () => {
    const messages = await sql`
      SELECT * FROM messages
      ORDER BY created_at DESC
      LIMIT 100
    `
    return messages as any
  })

  return {
    listMessages,
  }
}
