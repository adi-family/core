/**
 * Messages API handlers
 */

import { handler, type HandlerContext } from '@adi-family/http'
import { listMessagesConfig } from '@adi/api-contracts'
import type { Sql } from 'postgres'
import * as userAccessQueries from '@db/user-access'
import * as sessionQueries from '@db/sessions'
import * as taskQueries from '@db/tasks'
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'messages-handler' })

/**
 * Create message handlers
 */
export function createMessageHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: No Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw new Error('Unauthorized: Invalid token format')
    }

    if (!CLERK_SECRET_KEY) {
      throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
    }

    try {
      const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
      if (!payload.sub) {
        throw new Error('Unauthorized: Invalid token payload')
      }
      return payload.sub
    } catch (error) {
      logger.error('Token verification failed:', error)
      throw new Error('Unauthorized: Token verification failed')
    }
  }

  const listMessages = handler(listMessagesConfig, async (ctx) => {
    const userId = await getUserId(ctx)

    // Get user's accessible projects
    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)

    if (accessibleProjectIds.length === 0) {
      return []
    }

    // Get all messages
    const allMessages = await sql`
      SELECT * FROM messages
      ORDER BY created_at DESC
      LIMIT 100
    `

    // Filter messages by accessible projects
    const filteredMessages = []
    for (const message of allMessages) {
      if (message.session_id) {
        try {
          const session = await sessionQueries.findSessionById(sql, message.session_id)
          if (session.task_id) {
            const task = await taskQueries.findTaskById(sql, session.task_id)
            if (task.project_id && accessibleProjectIds.includes(task.project_id)) {
              filteredMessages.push(message)
            }
          }
        } catch (error) {
          // Skip messages with invalid session/task references
          logger.warn(`Failed to verify access for message ${message.id}:`, error)
        }
      }
    }

    return filteredMessages
  })

  return {
    listMessages,
  }
}
