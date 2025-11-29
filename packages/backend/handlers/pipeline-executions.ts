/**
 * Pipeline Execution handlers using @adi/http system
 */

import type { Sql } from 'postgres'
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
import { createSecuredHandlers } from '../utils/auth'

export function createPipelineExecutionHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  const listPipelineArtifacts = handler(listPipelineArtifactsConfig, async (ctx) => {
    const { execution_id } = ctx.query || {}

    if (execution_id) {
      await ctx.acl.execution(execution_id).viewer()
      return pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, execution_id)
    }

    // Without execution_id, filter by accessible projects
    const accessibleProjectIds = await ctx.acl.accessibleProjectIds()
    if (accessibleProjectIds.length === 0) {
      return []
    }

    // Get all artifacts and filter by accessible projects
    const allArtifacts = await pipelineArtifactQueries.findAllPipelineArtifacts(sql)
    const filteredArtifacts = []

    for (const artifact of allArtifacts) {
      if (artifact.pipeline_execution_id) {
        try {
          await ctx.acl.execution(artifact.pipeline_execution_id).viewer()
          filteredArtifacts.push(artifact)
        } catch {
          // Skip artifacts the user doesn't have access to
        }
      }
    }

    return filteredArtifacts
  })

  const getExecutionArtifacts = handler(getExecutionArtifactsConfig, async (ctx) => {
    const { executionId } = ctx.params
    await ctx.acl.execution(executionId).viewer()
    return pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, executionId)
  })

  const createExecutionArtifact = handler(createExecutionArtifactConfig, async (ctx) => {
    const { executionId } = ctx.params
    await ctx.acl.execution(executionId).developer()
    return pipelineArtifactQueries.createPipelineArtifact(sql, {
      ...ctx.body,
      pipeline_execution_id: executionId
    })
  })

  const createPipelineExecution = handler(createPipelineExecutionConfig, async (ctx) => {
    if (ctx.body.session_id) {
      await ctx.acl.session(ctx.body.session_id).developer()
    }
    return pipelineExecutionQueries.createPipelineExecution(sql, ctx.body)
  })

  const updatePipelineExecution = handler(updatePipelineExecutionConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.execution(id).developer()
    return pipelineExecutionQueries.updatePipelineExecution(sql, id, ctx.body)
  })

  const saveExecutionApiUsage = handler(saveExecutionApiUsageConfig, async (ctx) => {
    const { executionId } = ctx.params
    await ctx.acl.execution(executionId).developer()

    await apiUsageQueries.createApiUsageMetric(sql, {
      pipeline_execution_id: executionId,
      session_id: ctx.body.session_id,
      task_id: ctx.body.task_id,
      provider: ctx.body.provider,
      model: ctx.body.model,
      goal: ctx.body.goal,
      phase: ctx.body.phase,
      input_tokens: ctx.body.input_tokens ?? 0,
      output_tokens: ctx.body.output_tokens ?? 0,
      cache_creation_input_tokens: ctx.body.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: ctx.body.cache_read_input_tokens ?? 0,
      ci_duration_seconds: ctx.body.ci_duration_seconds ?? 0,
      iteration_number: ctx.body.iteration_number ?? 0,
      metadata: ctx.body.metadata
    })

    return { success: true, message: 'API usage saved successfully' }
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
