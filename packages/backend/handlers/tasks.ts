import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/tasks'
import * as fileSpaceQueries from '../../db/file-spaces'
import { idParamSchema, createTaskSchema, updateTaskSchema, taskQuerySchema } from '../schemas'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { getClerkUserId } from '../middleware/clerk'
import * as userAccessQueries from '../../db/user-access'
import * as taskSourceQueries from '../../db/task-sources'
import { publishTaskEval, publishTaskImpl } from '@adi/queue/publisher.ts'
import { createTaskSource } from '../task-sources/factory'

export const createTaskRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', zValidator('query', taskQuerySchema), async (c) => {
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      const queryParams = c.req.valid('query')
      const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)

      // Use server-side filtering, sorting, and pagination
      const result = await queries.findTasksWithFiltersPaginated(sql, {
        project_id: queryParams.project_id,
        task_source_id: queryParams.task_source_id,
        evaluated_only: queryParams.evaluated_only,
        sort_by: queryParams.sort_by,
        page: queryParams.page,
        per_page: queryParams.per_page
      })

      // Filter by accessible projects for security
      const filteredTasks = result.tasks.filter(t => t.project_id && accessibleProjectIds.includes(t.project_id))

      // Recalculate total and pages based on filtered results
      const _filteredTotal = filteredTasks.length

      return c.json({
        data: filteredTasks,
        pagination: {
          total: result.total,
          page: result.page,
          per_page: result.per_page,
          total_pages: result.total_pages
        }
      })
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access
        await acl.task(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.findTaskById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createTaskSchema), async (c) => {
      const body = c.req.valid('json')
      const userId = getClerkUserId(c)

      if (!userId) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      const task = await queries.createTask(sql, body)
      return c.json(task, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateTaskSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      try {
        // Require write access (inherits developer from project)
        await acl.task(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.updateTask(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require write access (inherits developer from project)
        await acl.task(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.deleteTask(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    .post('/:id/evaluate', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access to trigger evaluation
        await acl.task(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Verify task exists
      const taskResult = await queries.findTaskById(sql, id)
      if (!taskResult.ok) {
        return c.json({ error: 'Task not found' }, 404)
      }

      const task = taskResult.data

      // Check quota before queuing evaluation
      if (!task.project_id) {
        return c.json({ error: 'Task has no associated project' }, 400)
      }

      // Get project owner for quota checking
      const { getProjectOwnerId } = await import('@db/user-access')
      const userId = await getProjectOwnerId(sql, task.project_id)

      if (!userId) {
        return c.json({ error: 'No project owner found' }, 400)
      }

      // Check if user has quota available for simple evaluation
      const { selectAIProviderForEvaluation, QuotaExceededError } = await import('@backend/services/ai-provider-selector')
      try {
        await selectAIProviderForEvaluation(sql, userId, task.project_id, 'simple')
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          return c.json({ error: error.message }, 429)
        }
        throw error
      }

      // Publish evaluation message to queue
      await publishTaskEval({ taskId: id })

      return c.json({
        message: 'Task evaluation queued',
        taskId: id
      })
    })
    .post('/:id/implement', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require write access to trigger implementation
        await acl.task(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Verify task exists
      const taskResult = await queries.findTaskById(sql, id)
      if (!taskResult.ok) {
        return c.json({ error: 'Task not found' }, 404)
      }

      // Publish implementation message to queue
      await publishTaskImpl({ taskId: id })

      return c.json({
        message: 'Task implementation queued',
        taskId: id
      })
    })
    .post('/:id/refresh', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access to refresh task
        await acl.task(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Get the task
      const taskResult = await queries.findTaskById(sql, id)
      if (!taskResult.ok) {
        return c.json({ error: 'Task not found' }, 404)
      }

      const task = taskResult.data

      // Get the task source
      const taskSourceResult = await taskSourceQueries.findTaskSourceById(sql, task.task_source_id)
      if (!taskSourceResult.ok) {
        return c.json({ error: 'Task source not found' }, 404)
      }

      const taskSource = taskSourceResult.data

      // Only GitLab tasks are supported for now
      if (taskSource.type !== 'gitlab_issues' || !task.source_gitlab_issue?.iid) {
        return c.json({ error: 'Task refresh only supported for GitLab issues with IID' }, 400)
      }

      try {
        // Create task source instance and fetch current status
        const taskSourceInstance = createTaskSource(taskSource)

        if (!taskSourceInstance.revalidateIssues) {
          return c.json({ error: 'Task source does not support refresh' }, 400)
        }

        // Fetch the current issue status
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

        // Update the task with the current remote status
        const updateResult = await queries.updateTask(sql, id, {
          remote_status: currentIssue.state || 'opened',
          title: currentIssue.title,
          source_gitlab_issue: {
            ...task.source_gitlab_issue,
            title: currentIssue.title,
            updated_at: currentIssue.updatedAt
          }
        })

        if (!updateResult.ok) {
          return c.json({ error: updateResult.error }, 500)
        }

        return c.json({
          message: 'Task refreshed successfully',
          task: updateResult.data
        })
      } catch (error) {
        console.error('Error refreshing task:', error)
        return c.json({
          error: 'Failed to refresh task',
          details: error instanceof Error ? error.message : String(error)
        }, 500)
      }
    })
    .post('/:id/evaluation-status', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = await c.req.json()

      // Verify task exists
      const taskResult = await queries.findTaskById(sql, id)
      if (!taskResult.ok) {
        return c.json({ error: 'Task not found' }, 404)
      }

      // Validate status
      const validStatuses = ['pending', 'queued', 'evaluating', 'completed', 'failed']
      if (!body.status || !validStatuses.includes(body.status)) {
        return c.json({ error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') }, 400)
      }

      // Update task evaluation status
      const updateResult = await queries.updateTask(sql, id, {
        ai_evaluation_status: body.status
      })

      if (!updateResult.ok) {
        return c.json({ error: updateResult.error }, 500)
      }

      return c.json({
        message: 'Evaluation status updated successfully',
        task: updateResult.data
      })
    })
    .patch('/:id/evaluation-result', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = await c.req.json()

      // Verify task exists
      const taskResult = await queries.findTaskById(sql, id)
      if (!taskResult.ok) {
        return c.json({ error: 'Task not found' }, 404)
      }

      // Validate result
      const validResults = ['ready', 'needs_clarification']
      if (!body.result || !validResults.includes(body.result)) {
        return c.json({ error: 'Invalid result. Must be one of: ' + validResults.join(', ') }, 400)
      }

      // Update task evaluation result
      const updateResult = await queries.updateTaskEvaluationResult(sql, id, body.result)

      if (!updateResult.ok) {
        return c.json({ error: updateResult.error }, 500)
      }

      return c.json({
        message: 'Evaluation result updated successfully',
        task: updateResult.data
      })
    })
    .patch('/:id/evaluation-simple', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = await c.req.json()

      // Verify task exists
      const taskResult = await queries.findTaskById(sql, id)
      if (!taskResult.ok) {
        return c.json({ error: 'Task not found' }, 404)
      }

      // Update task simple evaluation result
      const updateResult = await queries.updateTask(sql, id, {
        ai_evaluation_simple_result: body.simpleResult
      })

      if (!updateResult.ok) {
        return c.json({ error: updateResult.error }, 500)
      }

      return c.json({
        message: 'Simple evaluation result updated successfully',
        task: updateResult.data
      })
    })
    .patch('/:id/evaluation-agentic', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const body = await c.req.json()

      // Verify task exists
      const taskResult = await queries.findTaskById(sql, id)
      if (!taskResult.ok) {
        return c.json({ error: 'Task not found' }, 404)
      }

      // Update task agentic evaluation result
      const updateResult = await queries.updateTask(sql, id, {
        ai_evaluation_agentic_result: body.agenticResult
      })

      if (!updateResult.ok) {
        return c.json({ error: updateResult.error }, 500)
      }

      return c.json({
        message: 'Agentic evaluation result updated successfully',
        task: updateResult.data
      })
    })
    .get('/:id/file-spaces', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access to the task
        await acl.task(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      // Get file spaces associated with this task via the junction table
      const fileSpaces = await fileSpaceQueries.findFileSpacesByTaskId(sql, id)
      return c.json(fileSpaces)
    })
}
