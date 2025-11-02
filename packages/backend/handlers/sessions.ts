/**
 * Session handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  getSessionMessagesConfig,
  getSessionPipelineExecutionsConfig
} from '@adi/api-contracts/sessions'
import * as messageQueries from '@db/messages'
import * as pipelineExecutionQueries from '@db/pipeline-executions'

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

  return {
    getSessionMessages,
    getSessionPipelineExecutions
  }
}
