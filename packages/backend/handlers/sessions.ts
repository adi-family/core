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

export function createSessionHandlers(sql: Sql) {
  const getSessionMessages = handler(getSessionMessagesConfig, async (ctx) => {
    const { sessionId } = ctx.params
    const messages = await messageQueries.findMessagesBySessionId(sql, sessionId)
    return messages
  })

  const getSessionPipelineExecutions = handler(getSessionPipelineExecutionsConfig, async (ctx) => {
    const { sessionId } = ctx.params
    const executions = await pipelineExecutionQueries.findPipelineExecutionsBySessionId(sql, sessionId)
    return executions
  })

  const getSession = handler(getSessionConfig, async (ctx) => {
    const { id } = ctx.params
    const session = await sessionQueries.findSessionById(sql, id)
    return session
  })

  const listSessions = handler(listSessionsConfig, async (_ctx) => {
    const sessions = await sessionQueries.findAllSessions(sql)
    return sessions
  })

  return {
    getSessionMessages,
    getSessionPipelineExecutions,
    getSession,
    listSessions
  }
}
