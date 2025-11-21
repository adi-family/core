/**
 * Session handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
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
import { getUserIdFromClerkToken, requireProjectAccess } from '../utils/auth'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'sessions-handler' })

export function createSessionHandlers(sql: Sql) {
  async function verifySessionAccess(userId: string, sessionId: string): Promise<void> {
    const session = await sessionQueries.findSessionById(sql, sessionId)

    if (!session.task_id) {
      throw new Error('Forbidden: Session not associated with a task')
    }

    const task = await taskQueries.findTaskById(sql, session.task_id)

    if (!task.project_id) {
      throw new Error('Forbidden: Task not associated with a project')
    }

    await requireProjectAccess(sql, userId, task.project_id)
  }

  const getSessionMessages = handler(getSessionMessagesConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { sessionId } = ctx.params

    await verifySessionAccess(userId, sessionId)

    const messages = await messageQueries.findMessagesBySessionId(sql, sessionId)
    return messages
  })

  const getSessionPipelineExecutions = handler(getSessionPipelineExecutionsConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { sessionId } = ctx.params

    await verifySessionAccess(userId, sessionId)

    const executions = await pipelineExecutionQueries.findPipelineExecutionsBySessionId(sql, sessionId)
    return executions
  })

  const getSession = handler(getSessionConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { id } = ctx.params

    await verifySessionAccess(userId, id)

    const session = await sessionQueries.findSessionById(sql, id)
    return session
  })

  const listSessions = handler(listSessionsConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))

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
