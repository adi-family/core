/**
 * Session handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler, type HandlerContext } from '@adi-family/http'
import {
  getSessionMessagesConfig,
  getSessionPipelineExecutionsConfig,
  getSessionConfig,
  listSessionsConfig
} from '@adi/api-contracts/sessions'
import * as messageQueries from '@db/messages'
import * as pipelineExecutionQueries from '@db/pipeline-executions'
import * as sessionQueries from '@db/sessions'
import * as taskQueries from '@db/tasks'
import * as userAccessQueries from '@db/user-access'
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'sessions-handler' })

export function createSessionHandlers(sql: Sql) {
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

  async function verifySessionAccess(userId: string, sessionId: string): Promise<void> {
    const session = await sessionQueries.findSessionById(sql, sessionId)

    if (!session.task_id) {
      throw new Error('Forbidden: Session not associated with a task')
    }

    const task = await taskQueries.findTaskById(sql, session.task_id)

    if (!task.project_id) {
      throw new Error('Forbidden: Task not associated with a project')
    }

    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, task.project_id)
    if (!hasAccess) {
      throw new Error('Forbidden: You do not have access to this session')
    }
  }

  const getSessionMessages = handler(getSessionMessagesConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { sessionId } = ctx.params

    await verifySessionAccess(userId, sessionId)

    const messages = await messageQueries.findMessagesBySessionId(sql, sessionId)
    return messages
  })

  const getSessionPipelineExecutions = handler(getSessionPipelineExecutionsConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { sessionId } = ctx.params

    await verifySessionAccess(userId, sessionId)

    const executions = await pipelineExecutionQueries.findPipelineExecutionsBySessionId(sql, sessionId)
    return executions
  })

  const getSession = handler(getSessionConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    await verifySessionAccess(userId, id)

    const session = await sessionQueries.findSessionById(sql, id)
    return session
  })

  const listSessions = handler(listSessionsConfig, async (ctx) => {
    const userId = await getUserId(ctx)

    // Get all accessible projects for the user
    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)

    if (accessibleProjectIds.length === 0) {
      return []
    }

    // Get all sessions and filter by accessible projects
    const allSessions = await sessionQueries.findAllSessions(sql)
    const filteredSessions = []

    for (const session of allSessions) {
      if (session.task_id) {
        try {
          const task = await taskQueries.findTaskById(sql, session.task_id)
          if (task.project_id && accessibleProjectIds.includes(task.project_id)) {
            filteredSessions.push(session)
          }
        } catch (error) {
          // Skip sessions with missing tasks
          logger.warn(`Task not found for session ${session.id}:`, error)
        }
      }
    }

    return filteredSessions
  })

  return {
    getSessionMessages,
    getSessionPipelineExecutions,
    getSession,
    listSessions
  }
}
