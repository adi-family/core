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
import * as sessionQueries from '@db/sessions'
import * as taskQueries from '@db/tasks'
import * as userAccessQueries from '@db/user-access'
import { getUserIdFromClerkToken } from '../utils/auth'
import { createLogger } from '@utils/logger'

const _logger = createLogger({ namespace: 'pipeline-executions-handler' })

export function createPipelineExecutionHandlers(sql: Sql) {
  async function verifyExecutionAccess(userId: string, executionId: string, minRole: 'viewer' | 'developer' = 'viewer'): Promise<void> {
    const execution = await pipelineExecutionQueries.findPipelineExecutionById(sql, executionId)

    if (!execution.session_id) {
      throw new Error('Forbidden: Pipeline execution not associated with a session')
    }

    const session = await sessionQueries.findSessionById(sql, execution.session_id)

    if (!session.task_id) {
      throw new Error('Forbidden: Session not associated with a task')
    }

    const task = await taskQueries.findTaskById(sql, session.task_id)

    if (!task.project_id) {
      throw new Error('Forbidden: Task not associated with a project')
    }

    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, task.project_id, minRole)
    if (!hasAccess) {
      throw new Error(`Forbidden: You do not have ${minRole} access to this execution's project`)
    }
  }

  const listPipelineArtifacts = handler(listPipelineArtifactsConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { execution_id } = ctx.query || {}

    if (execution_id) {
      await verifyExecutionAccess(userId, execution_id)
      return pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, execution_id)
    }

    // Without execution_id, we need to filter by accessible projects
    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
    if (accessibleProjectIds.length === 0) {
      return []
    }

    // Get all artifacts and filter by accessible projects
    const allArtifacts = await pipelineArtifactQueries.findAllPipelineArtifacts(sql)
    const filteredArtifacts = []

    for (const artifact of allArtifacts) {
      if (artifact.pipeline_execution_id) {
        try {
          await verifyExecutionAccess(userId, artifact.pipeline_execution_id)
          filteredArtifacts.push(artifact)
        } catch (_error) {
          // Skip artifacts the user doesn't have access to
        }
      }
    }

    return filteredArtifacts
  })

  const getExecutionArtifacts = handler(getExecutionArtifactsConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { executionId } = ctx.params

    await verifyExecutionAccess(userId, executionId)

    const artifacts = await pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, executionId)
    return artifacts
  })

  const createExecutionArtifact = handler(createExecutionArtifactConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { executionId } = ctx.params
    const body = ctx.body

    await verifyExecutionAccess(userId, executionId, 'developer')

    const artifactData = {
      ...body,
      pipeline_execution_id: executionId
    }
    const artifact = await pipelineArtifactQueries.createPipelineArtifact(sql, artifactData)
    return artifact
  })

  const createPipelineExecution = handler(createPipelineExecutionConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const body = ctx.body

    // Verify access to the session's project
    if (body.session_id) {
      const session = await sessionQueries.findSessionById(sql, body.session_id)
      if (session.task_id) {
        const task = await taskQueries.findTaskById(sql, session.task_id)
        if (task.project_id) {
          const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, task.project_id, 'developer')
          if (!hasAccess) {
            throw new Error('Forbidden: You do not have developer access to this project')
          }
        }
      }
    }

    const execution = await pipelineExecutionQueries.createPipelineExecution(sql, body)
    return execution
  })

  const updatePipelineExecution = handler(updatePipelineExecutionConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { id } = ctx.params
    const body = ctx.body

    await verifyExecutionAccess(userId, id, 'developer')

    const execution = await pipelineExecutionQueries.updatePipelineExecution(sql, id, body)
    return execution
  })

  const saveExecutionApiUsage = handler(saveExecutionApiUsageConfig, async (ctx) => {
    const userId = await getUserIdFromClerkToken(ctx.headers.get('Authorization'))
    const { executionId } = ctx.params
    const body = ctx.body

    await verifyExecutionAccess(userId, executionId, 'developer')

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
