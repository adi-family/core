/**
 * Task handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  getTaskSessionsConfig,
  getTaskArtifactsConfig,
  listTasksConfig,
  getTaskConfig,
  implementTaskConfig,
  evaluateTaskConfig
} from '@adi/api-contracts/tasks'
import * as sessionQueries from '@db/sessions'
import * as pipelineArtifactQueries from '@db/pipeline-artifacts'
import * as taskQueries from '@db/tasks'

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

  const listTasks = handler(listTasksConfig, async (ctx) => {
    const { project_id, limit } = ctx.query || {}

    // Use the findTasksWithFilters query to support filtering
    const tasks = await taskQueries.findTasksWithFilters(sql, {
      project_id,
      ...(limit && { per_page: limit })
    })

    return tasks
  })

  const getTask = handler(getTaskConfig, async (ctx) => {
    const { id } = ctx.params
    const task = await taskQueries.findTaskById(sql, id)
    return task
  })

  const implementTask = handler(implementTaskConfig, async (ctx) => {
    const { id } = ctx.params

    // Update task status to queued for implementation
    const task = await taskQueries.updateTaskImplementationStatus(sql, id, 'queued')

    // TODO: Queue task for implementation via message queue/RabbitMQ
    // For now, just return the updated task
    return {
      success: true,
      message: 'Task queued for implementation',
      task
    }
  })

  const evaluateTask = handler(evaluateTaskConfig, async (ctx) => {
    const { id } = ctx.params

    // Update task status to queued for evaluation
    const task = await taskQueries.updateTaskEvaluationStatus(sql, id, 'queued')

    // TODO: Queue task for evaluation via message queue/RabbitMQ
    // For now, just return the updated task
    return {
      success: true,
      message: 'Task queued for evaluation',
      task
    }
  })

  return {
    getTaskSessions,
    getTaskArtifacts,
    listTasks,
    getTask,
    implementTask,
    evaluateTask
  }
}
