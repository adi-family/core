/**
 * Task handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import {
  getTaskSessionsConfig,
  getTaskArtifactsConfig,
  listTasksConfig,
  getTaskConfig,
  implementTaskConfig,
  evaluateTaskConfig,
  evaluateTaskAdvancedConfig,
  getTaskStatsConfig,
  updateTaskImplementationStatusConfig,
  updateTaskConfig,
  createTaskConfig,
  deleteTaskConfig
} from '@adi/api-contracts/tasks'
import * as sessionQueries from '@db/sessions'
import * as pipelineArtifactQueries from '@db/pipeline-artifacts'
import * as taskQueries from '@db/tasks'
import * as taskSourceQueries from '@db/task-sources'
import { publishTaskEval, publishTaskImpl } from '@adi/queue/publisher'
import { evaluateTaskAdvanced } from '@adi/micros-task-eval/service'
import { createSecuredHandlers } from '../utils/auth'

export function createTaskHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  const getTaskSessions = handler(getTaskSessionsConfig, async (ctx) => {
    const { taskId } = ctx.params
    await ctx.acl.task(taskId).viewer()
    return sessionQueries.findSessionsByTaskId(sql, taskId)
  })

  const getTaskArtifacts = handler(getTaskArtifactsConfig, async (ctx) => {
    const { taskId } = ctx.params
    await ctx.acl.task(taskId).viewer()
    return pipelineArtifactQueries.findPipelineArtifactsByTaskId(sql, taskId)
  })

  const listTasks = handler(listTasksConfig, async (ctx) => {
    const { project_id, limit, search } = ctx.query || {}

    if (project_id) {
      await ctx.acl.project(project_id).viewer()
      return taskQueries.findTasksWithFilters(sql, {
        project_id,
        search,
        ...(limit && { per_page: limit })
      })
    }

    const accessibleProjectIds = await ctx.acl.accessibleProjectIds()
    const allTasks = await taskQueries.findTasksWithFilters(sql, {
      search,
      ...(limit && { per_page: limit })
    })

    return allTasks.filter(task => task.project_id && accessibleProjectIds.includes(task.project_id))
  })

  const getTask = handler(getTaskConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.task(id).viewer()
    return taskQueries.findTaskById(sql, id)
  })

  const implementTask = handler(implementTaskConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.task(id).developer()

    const task = await taskQueries.updateTaskImplementationStatus(sql, id, 'queued')
    await publishTaskImpl({ taskId: id })

    return { success: true, message: 'Task queued for implementation', task }
  })

  const evaluateTask = handler(evaluateTaskConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.task(id).developer()

    const task = await taskQueries.updateTaskEvaluationStatus(sql, id, 'queued')
    await publishTaskEval({ taskId: id })

    return { success: true, message: 'Task queued for simple evaluation', task }
  })

  const evaluateTaskAdvancedHandler = handler(evaluateTaskAdvancedConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.task(id).developer()

    const result = await evaluateTaskAdvanced(sql, { taskId: id })

    if (result.errors.length > 0) {
      return { success: false, message: result.errors.join(', ') }
    }

    return {
      success: true,
      message: 'Advanced evaluation started successfully',
      evaluation: { sessionId: result.sessionId, pipelineUrl: result.pipelineUrl }
    }
  })

  const getTaskStats = handler(getTaskStatsConfig, async (ctx) => {
    const { project_id, task_source_id, evaluated_only, sort_by, search } = ctx.query || {}

    if (project_id) {
      await ctx.acl.project(project_id).viewer()
    }

    const tasks = await taskQueries.findTasksWithFilters(sql, {
      project_id,
      task_source_id,
      evaluated_only,
      sort_by,
      search
    })

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

    const taskTypeCounts: Record<string, number> = {}
    tasks.forEach(task => {
      const taskType = (task.ai_evaluation_simple_result as any)?.task_type || 'unknown'
      taskTypeCounts[taskType] = (taskTypeCounts[taskType] || 0) + 1
    })

    const effortCounts: Record<string, number> = {}
    tasks.forEach(task => {
      const effort = (task.ai_evaluation_simple_result as any)?.effort_estimate || 'unknown'
      effortCounts[effort] = (effortCounts[effort] || 0) + 1
    })

    const riskCounts: Record<string, number> = {}
    tasks.forEach(task => {
      const risk = (task.ai_evaluation_simple_result as any)?.risk_level || 'unknown'
      riskCounts[risk] = (riskCounts[risk] || 0) + 1
    })

    const complexityScores = tasks
      .filter(t => (t.ai_evaluation_simple_result as any)?.complexity_score)
      .map(t => (t.ai_evaluation_simple_result as any).complexity_score)
    const avgComplexity = complexityScores.length > 0
      ? (complexityScores.reduce((a: number, b: number) => a + b, 0) / complexityScores.length).toFixed(1)
      : '0.0'

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
          title: t.title.length > 40 ? `${t.title.substring(0, 40)  }...` : t.title,
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

  const updateTaskImplementationStatusHandler = handler(updateTaskImplementationStatusConfig, async (ctx) => {
    const { id } = ctx.params
    const { status } = ctx.body
    await ctx.acl.task(id).developer()
    await taskQueries.updateTaskImplementationStatus(sql, id, status)
    return { success: true, message: `Task implementation status updated to ${status}` }
  })

  const updateTaskHandler = handler(updateTaskConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.task(id).developer()
    return taskQueries.updateTask(sql, id, ctx.body)
  })

  const createTask = handler(createTaskConfig, async (ctx) => {
    const { title, description, project_id, status } = ctx.body
    await ctx.acl.project(project_id).developer()

    const manualSource = await taskSourceQueries.findOrCreateManualTaskSource(sql, project_id)

    return taskQueries.createTask(sql, {
      title,
      description,
      status: status || 'opened',
      remote_status: 'opened',
      project_id,
      task_source_id: manualSource.id,
      created_by_user_id: ctx.userId,
      manual_task_metadata: { created_via: 'ui', custom_properties: {} }
    })
  })

  const deleteTask = handler(deleteTaskConfig, async (ctx) => {
    const { id } = ctx.params
    const task = await taskQueries.findTaskById(sql, id)

    if (!task.manual_task_metadata) {
      throw new Error('Forbidden: Only manually created tasks can be deleted')
    }

    await ctx.acl.task(id).developer()
    await taskQueries.deleteTask(sql, id)
    return { success: true }
  })

  return {
    getTaskSessions,
    getTaskArtifacts,
    listTasks,
    getTask,
    implementTask,
    evaluateTask,
    evaluateTaskAdvanced: evaluateTaskAdvancedHandler,
    getTaskStats,
    updateTaskImplementationStatus: updateTaskImplementationStatusHandler,
    updateTask: updateTaskHandler,
    createTask,
    deleteTask
  }
}
