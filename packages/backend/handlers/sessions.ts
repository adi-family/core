/**
 * Session handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import {
  getSessionMessagesConfig,
  getSessionPipelineExecutionsConfig,
  getSessionConfig,
  listSessionsConfig
} from '@adi/api-contracts/sessions'
import * as messageQueries from '@db/messages'
import * as pipelineExecutionQueries from '@db/pipeline-executions'
import * as sessionQueries from '@db/sessions'
import { createSecuredHandlers } from '../utils/auth'

export function createSessionHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  const getSessionMessages = handler(getSessionMessagesConfig, async (ctx) => {
    const { sessionId } = ctx.params
    await ctx.acl.session(sessionId).viewer()
    return messageQueries.findMessagesBySessionId(sql, sessionId)
  })

  const getSessionPipelineExecutions = handler(getSessionPipelineExecutionsConfig, async (ctx) => {
    const { sessionId } = ctx.params
    await ctx.acl.session(sessionId).viewer()
    return pipelineExecutionQueries.findPipelineExecutionsBySessionId(sql, sessionId)
  })

  const getSession = handler(getSessionConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.session(id).viewer()
    return sessionQueries.findSessionById(sql, id)
  })

  const listSessions = handler(listSessionsConfig, async (ctx) => {
    const accessibleProjectIds = await ctx.acl.accessibleProjectIds()
    if (accessibleProjectIds.length === 0) {
      return []
    }

    const allSessions = await sessionQueries.findAllSessions(sql)
    const filteredSessions = []

    for (const session of allSessions) {
      if (session.task_id) {
        try {
          await ctx.acl.session(session.id).viewer()
          filteredSessions.push(session)
        } catch {
          // Skip sessions the user doesn't have access to
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
