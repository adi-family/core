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
  updatePipelineExecutionConfig,
  saveExecutionApiUsageConfig
} from '@adi/api-contracts/pipeline-executions'
import * as pipelineArtifactQueries from '@db/pipeline-artifacts'
import * as pipelineExecutionQueries from '@db/pipeline-executions'
import * as apiUsageQueries from '@db/api-usage-metrics'

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

  const saveExecutionApiUsage = handler(saveExecutionApiUsageConfig, async (ctx) => {
    const { executionId } = ctx.params
    const body = ctx.body

    await apiUsageQueries.createApiUsageMetric(sql, {
      pipeline_execution_id: executionId,
      session_id: body.session_id,
      task_id: body.task_id,
      provider: body.provider,
      model: body.model,
      goal: body.goal,
      phase: body.phase,
      input_tokens: body.input_tokens ?? 0,
      output_tokens: body.output_tokens ?? 0,
      cache_creation_input_tokens: body.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: body.cache_read_input_tokens ?? 0,
      ci_duration_seconds: body.ci_duration_seconds ?? 0,
      iteration_number: body.iteration_number ?? 0,
      metadata: body.metadata
    })

    return {
      success: true,
      message: 'API usage saved successfully'
    }
  })

  return {
    listPipelineArtifacts,
    getExecutionArtifacts,
    createExecutionArtifact,
    createPipelineExecution,
    updatePipelineExecution,
    saveExecutionApiUsage
  }
}
