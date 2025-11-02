/**
 * Pipeline Execution handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  getExecutionArtifactsConfig,
  createExecutionArtifactConfig,
  updatePipelineExecutionConfig
} from '@adi/api-contracts/pipeline-executions'
import * as pipelineArtifactQueries from '@db/pipeline-artifacts'
import * as pipelineExecutionQueries from '@db/pipeline-executions'

export function createPipelineExecutionHandlers(sql: Sql) {
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

  const updatePipelineExecution = handler(updatePipelineExecutionConfig, async (ctx) => {
    const { id } = ctx.params
    const body = ctx.body
    const execution = await pipelineExecutionQueries.updatePipelineExecution(sql, id, body)
    return execution
  })

  return {
    getExecutionArtifacts,
    createExecutionArtifact,
    updatePipelineExecution
  }
}
