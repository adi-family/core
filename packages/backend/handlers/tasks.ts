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
  evaluateTaskConfig,
  evaluateTaskAdvancedConfig,
  getTaskStatsConfig
} from '@adi/api-contracts/tasks'
import * as sessionQueries from '@db/sessions'
import * as pipelineArtifactQueries from '@db/pipeline-artifacts'
import * as taskQueries from '@db/tasks'
import { publishTaskEval, publishTaskImpl } from '@adi/queue/publisher'
import { evaluateTaskAdvanced } from '@adi/micros-task-eval/service'

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

    // Publish task to implementation queue
    await publishTaskImpl({ taskId: id })

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

    // Publish task to evaluation queue
    await publishTaskEval({ taskId: id })

    return {
      success: true,
      message: 'Task queued for simple evaluation',
      task
    }
  })

  const evaluateTaskAdvancedHandler = handler(evaluateTaskAdvancedConfig, async (ctx) => {
    const { id } = ctx.params

    // Trigger advanced evaluation directly (not via queue)
    const result = await evaluateTaskAdvanced(sql, { taskId: id })

    if (result.errors.length > 0) {
      return {
        success: false,
        message: result.errors.join(', ')
      }
    }

    return {
      success: true,
      message: 'Advanced evaluation started successfully',
      evaluation: {
        sessionId: result.sessionId,
        pipelineUrl: result.pipelineUrl
      }
    }
  })

  const getTaskStats = handler(getTaskStatsConfig, async (ctx) => {
    const { project_id, task_source_id, evaluated_only, sort_by } = ctx.query || {}

    // Fetch tasks with the same filters as the list view
    const tasks = await taskQueries.findTasksWithFilters(sql, {
      project_id,
      task_source_id,
      evaluated_only: evaluated_only === 'true' ? true : undefined,
      sort_by: sort_by as 'created_desc' | 'created_asc' | 'quick_win_desc' | 'quick_win_asc' | 'complexity_asc' | 'complexity_desc' | undefined
    })

    // Calculate statistics
    const evaluatedTasks = tasks.filter(t =>
      t.ai_evaluation_simple_status === 'completed' ||
      t.ai_evaluation_advanced_status === 'completed'
    )

    const implementedTasks = tasks.filter(t =>
      t.ai_implementation_status === 'completed'
    )

    const inProgressTasks = tasks.filter(t =>
      t.ai_implementation_status === 'implementing' ||
      t.ai_evaluation_simple_status === 'evaluating' ||
      t.ai_evaluation_advanced_status === 'evaluating'
    )

    // Task type distribution
    const taskTypeCounts: Record<string, number> = {}
    tasks.forEach(task => {
      const taskType = (task.ai_evaluation_simple_result as any)?.task_type || 'unknown'
      taskTypeCounts[taskType] = (taskTypeCounts[taskType] || 0) + 1
    })

    // Effort estimate distribution
    const effortCounts: Record<string, number> = {}
    tasks.forEach(task => {
      const effort = (task.ai_evaluation_simple_result as any)?.effort_estimate || 'unknown'
      effortCounts[effort] = (effortCounts[effort] || 0) + 1
    })

    // Risk level distribution
    const riskCounts: Record<string, number> = {}
    tasks.forEach(task => {
      const risk = (task.ai_evaluation_simple_result as any)?.risk_level || 'unknown'
      riskCounts[risk] = (riskCounts[risk] || 0) + 1
    })

    // Complexity score average
    const complexityScores = tasks
      .filter(t => (t.ai_evaluation_simple_result as any)?.complexity_score)
      .map(t => (t.ai_evaluation_simple_result as any).complexity_score)
    const avgComplexity = complexityScores.length > 0
      ? (complexityScores.reduce((a: number, b: number) => a + b, 0) / complexityScores.length).toFixed(1)
      : '0.0'

    // Quadrant data: Impact vs Effort
    const impactEffortMap: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3
    }

    const quadrantData = tasks
      .filter(t => (t.ai_evaluation_simple_result as any)?.estimated_impact && (t.ai_evaluation_simple_result as any)?.estimated_effort)
      .map(t => {
        const result = t.ai_evaluation_simple_result as any
        const impact = impactEffortMap[result.estimated_impact] || 2
        const effort = impactEffortMap[result.estimated_effort] || 2

        return {
          x: effort,
          y: impact,
          title: t.title.length > 40 ? t.title.substring(0, 40) + '...' : t.title,
          id: t.id,
          impactLabel: result.estimated_impact,
          effortLabel: result.estimated_effort
        }
      })

    return {
      total: tasks.length,
      evaluated: evaluatedTasks.length,
      implemented: implementedTasks.length,
      inProgress: inProgressTasks.length,
      avgComplexity,
      quadrantData,
      taskTypeData: Object.entries(taskTypeCounts)
        .map(([name, value]) => ({
          name: name.replace(/_/g, ' '),
          value
        }))
        .sort((a, b) => b.value - a.value),
      effortData: ['xs', 's', 'm', 'l', 'xl', 'unknown']
        .filter(effort => effortCounts[effort])
        .map(effort => ({
          name: effort.toUpperCase(),
          value: effortCounts[effort]
        })),
      riskData: ['low', 'medium', 'high', 'unknown']
        .filter(risk => riskCounts[risk])
        .map(risk => ({
          name: risk.charAt(0).toUpperCase() + risk.slice(1),
          value: riskCounts[risk]
        }))
    }
  })

  return {
    getTaskSessions,
    getTaskArtifacts,
    listTasks,
    getTask,
    implementTask,
    evaluateTask,
    evaluateTaskAdvanced: evaluateTaskAdvancedHandler,
    getTaskStats
  }
}
