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
import * as userAccessQueries from '@db/user-access'
import { publishTaskEval, publishTaskImpl } from '@adi/queue/publisher'
import { evaluateTaskAdvanced } from '@adi/micros-task-eval/service'

/**
 * Extract user ID from request headers
 * TODO: Integrate with proper authentication middleware (Clerk)
 */
function getUserIdFromHeaders(ctx: any): string | null {
  // Try to get from X-User-Id header (set by auth middleware)
  const userId = ctx.headers?.['x-user-id'] || ctx.headers?.['X-User-Id']
  return userId || null
}

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
    const { project_id, limit, search } = ctx.query || {}

    // Use the findTasksWithFilters query to support filtering
    const tasks = await taskQueries.findTasksWithFilters(sql, {
      project_id,
      search,
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

    const task = await taskQueries.updateTaskImplementationStatus(sql, id, 'queued')

    await publishTaskImpl({ taskId: id })

    return {
      success: true,
      message: 'Task queued for implementation',
      task
    }
  })

  const evaluateTask = handler(evaluateTaskConfig, async (ctx) => {
    const { id } = ctx.params

    const task = await taskQueries.updateTaskEvaluationStatus(sql, id, 'queued')

    await publishTaskEval({ taskId: id })

    return {
      success: true,
      message: 'Task queued for simple evaluation',
      task
    }
  })

  const evaluateTaskAdvancedHandler = handler(evaluateTaskAdvancedConfig, async (ctx) => {
    const { id } = ctx.params

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
    const { project_id, task_source_id, evaluated_only, sort_by, search } = ctx.query || {}

    const tasks = await taskQueries.findTasksWithFilters(sql, {
      project_id,
      task_source_id,
      evaluated_only: evaluated_only === 'true' ? true : undefined,
      sort_by: sort_by as 'created_desc' | 'created_asc' | 'quick_win_desc' | 'quick_win_asc' | 'complexity_asc' | 'complexity_desc' | undefined,
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

    await taskQueries.updateTaskImplementationStatus(sql, id, status)

    return {
      success: true,
      message: `Task implementation status updated to ${status}`
    }
  })

  const updateTaskHandler = handler(updateTaskConfig, async (ctx) => {
    const { id } = ctx.params
    const body = ctx.body

    const task = await taskQueries.updateTask(sql, id, body)
    return task
  })

  const createTask = handler(createTaskConfig, async (ctx) => {
    const { title, description, project_id, status } = ctx.body

    // Get user ID from request
    const userId = getUserIdFromHeaders(ctx)
    if (!userId) {
      throw new Error('Authentication required. User ID not found in request.')
    }

    // Check if user has access to the project
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, project_id, 'developer')
    if (!hasAccess) {
      throw new Error('You do not have permission to create tasks in this project. Project owner or developer access required.')
    }

    // Get or create manual task source for this project
    const manualSource = await taskSourceQueries.findOrCreateManualTaskSource(sql, project_id)

    // Create task with manual metadata
    const task = await taskQueries.createTask(sql, {
      title,
      description,
      status: status || 'opened',
      remote_status: 'opened',
      project_id,
      task_source_id: manualSource.id,
      created_by_user_id: userId,
      manual_task_metadata: {
        created_via: 'ui',
        custom_properties: {}
      }
    })

    return task
  })

  const deleteTask = handler(deleteTaskConfig, async (ctx) => {
    const { id } = ctx.params

    // Get user ID from request
    const userId = getUserIdFromHeaders(ctx)
    if (!userId) {
      throw new Error('Authentication required. User ID not found in request.')
    }

    // Get task to check if it can be deleted
    const task = await taskQueries.findTaskById(sql, id)

    // Only allow deletion of manually created tasks
    if (!task.manual_task_metadata) {
      throw new Error('Only manually created tasks can be deleted. Tasks synced from external sources cannot be deleted.')
    }

    // Get the project ID for this task
    if (!task.project_id) {
      throw new Error('Task has no associated project')
    }

    // Check if user has access to the project
    // Users with developer access or higher can delete manual tasks in their projects
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, task.project_id, 'developer')
    if (!hasAccess) {
      throw new Error('You do not have permission to delete tasks in this project. Project owner or developer access required.')
    }

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
