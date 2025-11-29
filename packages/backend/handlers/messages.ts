/**
 * Messages API handlers
 */

import { listMessagesConfig } from '@adi/api-contracts'
import type { Sql } from 'postgres'
import { findRecentMessages } from '@db/messages'
import { createSecuredHandlers } from '../utils/auth'

/**
 * Create message handlers
 */
export function createMessageHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  const listMessages = handler(listMessagesConfig, async (ctx) => {
    const accessibleProjectIds = await ctx.acl.accessibleProjectIds()
    if (accessibleProjectIds.length === 0) {
      return []
    }

    const allMessages = await findRecentMessages(sql, 100)
    const filteredMessages = []

    for (const message of allMessages) {
      if (message.session_id) {
        try {
          await ctx.acl.session(message.session_id).viewer()
          filteredMessages.push(message)
        } catch {
          // Skip messages the user doesn't have access to
        }
      }
    }

    return filteredMessages
  })

  return { listMessages }
}
