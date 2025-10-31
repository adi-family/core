import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/tasks'
import * as fileSpaceQueries from '../../db/file-spaces'
import { idParamSchema, createTaskSchema, updateTaskSchema, taskQuerySchema } from '../schemas'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { reqAuthed } from '../middleware/authz'
import * as userAccessQueries from '../../db/user-access'
import * as taskSourceQueries from '../../db/task-sources'
import { publishTaskEval, publishTaskImpl } from '@adi/queue/publisher'
import { createTaskSource } from '../task-sources/factory'
import { getProjectOwnerId } from '@db/user-access'
import { selectAIProviderForEvaluation, QuotaExceededError } from '@backend/services/ai-provider-selector'

// Route Handlers
async function handleListTasks(c: any, sql: Sql) {
  const userId = await reqAuthed(c)
  const queryParams = c.req.valid('query')
  const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)

  const result = await queries.findTasksWithFiltersPaginated(sql, {
    project_id: queryParams.project_id,
    task_source_id: queryParams.task_source_id,
    evaluated_only: queryParams.evaluated_only,
    sort_by: queryParams.sort_by,
    page: queryParams.page,
    per_page: queryParams.per_page
  })

  const filteredTasks = result.tasks.filter(t => t.project_id && accessibleProjectIds.includes(t.project_id))

  return c.json({
    data: filteredTasks,
    pagination: {
      total: result.total,
      page: result.page,
      per_page: result.per_page,
      total_pages: result.total_pages
    }
  })
}

async function handleGetTaskById(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.task(id).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const task = await queries.findTaskById(sql, id)
  return c.json(task)
}

async function handleCreateTask(c: any, sql: Sql) {
  const body = c.req.valid('json')
  await reqAuthed(c)
  const task = await queries.createTask(sql, body)
  return c.json(task, 201)
}

async function handleUpdateTask(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  try {
    await acl.task(id).write.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const task = await queries.updateTask(sql, id, body)
  return c.json(task)
}

async function handleDeleteTask(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.task(id).write.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  await queries.deleteTask(sql, id)
  return c.json({ success: true })
}

async function handleEvaluateTask(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.task(id).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const task = await queries.findTaskById(sql, id)

  if (!task.project_id) {
    return c.json({ error: 'Task has no associated project' }, 400)
  }

  const userId = await getProjectOwnerId(sql, task.project_id)

  if (!userId) {
    return c.json({ error: 'No project owner found' }, 400)
  }

  try {
    await selectAIProviderForEvaluation(sql, userId, task.project_id, 'simple')
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return c.json({ error: error.message }, 429)
    }
    throw error
  }

  await publishTaskEval({ taskId: id })

  return c.json({
    message: 'Task evaluation queued',
    taskId: id
  })
}

async function handleImplementTask(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.task(id).write.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  await queries.findTaskById(sql, id)
  await publishTaskImpl({ taskId: id })

  return c.json({
    message: 'Task implementation queued',
    taskId: id
  })
}

async function handleRefreshTask(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.task(id).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const task = await queries.findTaskById(sql, id)
  const taskSource = await taskSourceQueries.findTaskSourceById(sql, task.task_source_id)

  if (taskSource.type !== 'gitlab_issues' || !task.source_gitlab_issue?.iid) {
    return c.json({ error: 'Task refresh only supported for GitLab issues with IID' }, 400)
  }

  try {
    const taskSourceInstance = createTaskSource(taskSource)

    if (!taskSourceInstance.revalidateIssues) {
      return c.json({ error: 'Task source does not support refresh' }, 400)
    }

    const issuesIterable = taskSourceInstance.revalidateIssues([task.source_gitlab_issue.iid])
    let currentIssue: { state?: 'opened' | 'closed'; id: string; title: string; updatedAt: string } | null = null

    for await (const issue of issuesIterable) {
      if (issue.id === task.source_gitlab_issue.id) {
        currentIssue = issue
        break
      }
    }

    if (!currentIssue) {
      return c.json({ error: 'Issue not found on remote' }, 404)
    }

    const updatedTask = await queries.updateTask(sql, id, {
      remote_status: currentIssue.state || 'opened',
      title: currentIssue.title,
      source_gitlab_issue: {
        ...task.source_gitlab_issue,
        title: currentIssue.title,
        updated_at: currentIssue.updatedAt
      }
    })

    return c.json({
      message: 'Task refreshed successfully',
      task: updatedTask
    })
  } catch (error) {
    console.error('Error refreshing task:', error)
    return c.json({
      error: 'Failed to refresh task',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
}

async function handleUpdateEvaluationStatus(c: any, sql: Sql) {
  const { id } = c.req.valid('param')
  const body = await c.req.json()

  await queries.findTaskById(sql, id)

  const validStatuses = ['pending', 'queued', 'evaluating', 'completed', 'failed']
  if (!body.status || !validStatuses.includes(body.status)) {
    return c.json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') }, 400)
  }

  const updatedTask = await queries.updateTask(sql, id, {
    ai_evaluation_status: body.status
  })

  return c.json({
    message: 'Evaluation status updated successfully',
    task: updatedTask
  })
}

async function handleUpdateEvaluationResult(c: any, sql: Sql) {
  const { id } = c.req.valid('param')
  const body = await c.req.json()

  await queries.findTaskById(sql, id)

  const validResults = ['ready', 'needs_clarification']
  if (!body.result || !validResults.includes(body.result)) {
    return c.json({ error: 'Invalid result. Must be one of: ' + validResults.join(', ') }, 400)
  }

  const updatedTask = await queries.updateTaskEvaluationResult(sql, id, body.result)

  return c.json({
    message: 'Evaluation result updated successfully',
    task: updatedTask
  })
}

async function handleUpdateSimpleEvaluation(c: any, sql: Sql) {
  const { id } = c.req.valid('param')
  const body = await c.req.json()

  await queries.findTaskById(sql, id)

  const updatedTask = await queries.updateTask(sql, id, {
    ai_evaluation_simple_result: body.simpleResult
  })

  return c.json({
    message: 'Simple evaluation result updated successfully',
    task: updatedTask
  })
}

async function handleUpdateAgenticEvaluation(c: any, sql: Sql) {
  const { id } = c.req.valid('param')
  const body = await c.req.json()

  await queries.findTaskById(sql, id)

  const updatedTask = await queries.updateTask(sql, id, {
    ai_evaluation_agentic_result: body.agenticResult
  })

  return c.json({
    message: 'Agentic evaluation result updated successfully',
    task: updatedTask
  })
}

async function handleGetTaskFileSpaces(c: any, sql: Sql, acl: ReturnType<typeof createFluentACL>) {
  const { id } = c.req.valid('param')

  try {
    await acl.task(id).read.throw(c)
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }
    throw error
  }

  const fileSpaces = await fileSpaceQueries.findFileSpacesByTaskId(sql, id)
  return c.json(fileSpaces)
}

export const createTaskRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', zValidator('query', taskQuerySchema), async (c) => handleListTasks(c, sql))
    .get('/:id', zValidator('param', idParamSchema), async (c) => handleGetTaskById(c, sql, acl))
    .post('/', zValidator('json', createTaskSchema), async (c) => handleCreateTask(c, sql))
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateTaskSchema), async (c) =>
      handleUpdateTask(c, sql, acl)
    )
    .delete('/:id', zValidator('param', idParamSchema), async (c) => handleDeleteTask(c, sql, acl))
    .post('/:id/evaluate', zValidator('param', idParamSchema), async (c) => handleEvaluateTask(c, sql, acl))
    .post('/:id/implement', zValidator('param', idParamSchema), async (c) => handleImplementTask(c, sql, acl))
    .post('/:id/refresh', zValidator('param', idParamSchema), async (c) => handleRefreshTask(c, sql, acl))
    .post('/:id/evaluation-status', zValidator('param', idParamSchema), async (c) =>
      handleUpdateEvaluationStatus(c, sql)
    )
    .patch('/:id/evaluation-result', zValidator('param', idParamSchema), async (c) =>
      handleUpdateEvaluationResult(c, sql)
    )
    .patch('/:id/evaluation-simple', zValidator('param', idParamSchema), async (c) =>
      handleUpdateSimpleEvaluation(c, sql)
    )
    .patch('/:id/evaluation-agentic', zValidator('param', idParamSchema), async (c) =>
      handleUpdateAgenticEvaluation(c, sql)
    )
    .get('/:id/file-spaces', zValidator('param', idParamSchema), async (c) =>
      handleGetTaskFileSpaces(c, sql, acl)
    )
}
