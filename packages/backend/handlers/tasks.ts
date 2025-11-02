/**
 * Task handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  getTaskSessionsConfig,
  getTaskArtifactsConfig
} from '@adi/api-contracts/tasks'
import * as sessionQueries from '@db/sessions'
import * as pipelineArtifactQueries from '@db/pipeline-artifacts'

export function createTaskHandlers(sql: Sql) {
  const getTaskSessions = handler(getTaskSessionsConfig, async (ctx) => {
    const { taskId } = ctx.params
    const sessions = await sessionQueries.findSessionsByTaskId(sql, taskId)
    return sessions
  })

  const getTaskArtifacts = handler(getTaskArtifactsConfig, async (ctx) => {
    const { taskId } = ctx.params
    const artifacts = await pipelineArtifactQueries.findPipelineArtifactsByTaskId(sql, taskId)
    return artifacts
  })

  return {
    getTaskSessions,
    getTaskArtifacts
  }
}
