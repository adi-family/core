/**
 * Pipeline Execution handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  listPipelineArtifactsConfig,
  getExecutionArtifactsConfig,
  createExecutionArtifactConfig,
  createPipelineExecutionConfig,
  updatePipelineExecutionConfig
} from '@adi/api-contracts/pipeline-executions'
import * as pipelineArtifactQueries from '@db/pipeline-artifacts'
import * as pipelineExecutionQueries from '@db/pipeline-executions'

export function createPipelineExecutionHandlers(sql: Sql) {
  const listPipelineArtifacts = handler(listPipelineArtifactsConfig, async (ctx) => {
    const { execution_id } = ctx.query || {}

    if (execution_id) {
      return pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, execution_id)
    }

    return pipelineArtifactQueries.findAllPipelineArtifacts(sql)
  })

  const getExecutionArtifacts = handler(getExecutionArtifactsConfig, async (ctx) => {
    const { executionId } = ctx.params
    const artifacts = await pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, executionId)
    return artifacts
  })

  const createExecutionArtifact = handler(createExecutionArtifactConfig, async (ctx) => {
    const { executionId } = ctx.params
    const body = ctx.body
    const artifactData = {
      ...body,
      pipeline_execution_id: executionId
    }
    const artifact = await pipelineArtifactQueries.createPipelineArtifact(sql, artifactData)
    return artifact
  })

  const createPipelineExecution = handler(createPipelineExecutionConfig, async (ctx) => {
    const body = ctx.body
    const execution = await pipelineExecutionQueries.createPipelineExecution(sql, body)
    return execution
  })

  const updatePipelineExecution = handler(updatePipelineExecutionConfig, async (ctx) => {
    const { id } = ctx.params
    const body = ctx.body
    const execution = await pipelineExecutionQueries.updatePipelineExecution(sql, id, body)
    return execution
  })

  return {
    listPipelineArtifacts,
    getExecutionArtifacts,
    createExecutionArtifact,
    createPipelineExecution,
    updatePipelineExecution
  }
}
