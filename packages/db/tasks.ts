import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Task, CreateTaskInput, UpdateTaskInput, Result } from '@types'
import { filterPresentColumns } from './utils'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllTasks = async (sql: Sql): Promise<Task[]> => {
  return get(sql<Task[]>`SELECT * FROM tasks ORDER BY created_at DESC`)
}

export type TaskQueryOptions = {
  project_id?: string
  task_source_id?: string
  evaluated_only?: boolean
  sort_by?: 'created_desc' | 'created_asc' | 'quick_win_desc' | 'quick_win_asc' | 'complexity_asc' | 'complexity_desc'
}

export const findTasksWithFilters = async (sql: Sql, options: TaskQueryOptions): Promise<Task[]> => {
  const { project_id, task_source_id, evaluated_only, sort_by = 'created_desc' } = options

  // Build WHERE conditions
  const conditions: string[] = []
  const params: any[] = []

  if (project_id) {
    conditions.push(`project_id = $${params.length + 1}`)
    params.push(project_id)
  }

  if (task_source_id) {
    conditions.push(`task_source_id = $${params.length + 1}`)
    params.push(task_source_id)
  }

  if (evaluated_only) {
    conditions.push(`ai_evaluation_simple_result IS NOT NULL`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Build ORDER BY clause
  let orderByClause: string
  switch (sort_by) {
    case 'created_asc':
      orderByClause = 'ORDER BY created_at ASC'
      break
    case 'quick_win_desc':
      // Quick win = high impact / low effort
      // Using COALESCE to handle null values, putting them last
      orderByClause = `ORDER BY
        CASE
          WHEN ai_evaluation_simple_result IS NULL THEN 1
          ELSE 0
        END,
        (COALESCE((ai_evaluation_simple_result->>'estimated_impact')::text, 'low')) DESC,
        (COALESCE((ai_evaluation_simple_result->>'estimated_effort')::text, 'high')) ASC`
      break
    case 'quick_win_asc':
      orderByClause = `ORDER BY
        CASE
          WHEN ai_evaluation_simple_result IS NULL THEN 1
          ELSE 0
        END,
        (COALESCE((ai_evaluation_simple_result->>'estimated_impact')::text, 'low')) ASC,
        (COALESCE((ai_evaluation_simple_result->>'estimated_effort')::text, 'high')) DESC`
      break
    case 'complexity_asc':
      orderByClause = `ORDER BY
        CASE
          WHEN ai_evaluation_simple_result IS NULL THEN 1
          ELSE 0
        END,
        COALESCE((ai_evaluation_simple_result->>'complexity_score')::numeric, 999) ASC`
      break
    case 'complexity_desc':
      orderByClause = `ORDER BY
        CASE
          WHEN ai_evaluation_simple_result IS NULL THEN 1
          ELSE 0
        END,
        COALESCE((ai_evaluation_simple_result->>'complexity_score')::numeric, 0) DESC`
      break
    case 'created_desc':
    default:
      orderByClause = 'ORDER BY created_at DESC'
      break
  }

  const query = `SELECT * FROM tasks ${whereClause} ${orderByClause}`

  return get(sql.unsafe(query, params) as any)
}

export const findTaskById = async (sql: Sql, id: string): Promise<Result<Task>> => {
  const tasks = await get(sql<Task[]>`SELECT * FROM tasks WHERE id = ${id}`)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

const createTaskCols = ['title', 'description', 'status', 'remote_status', 'project_id', 'task_source_id', 'source_gitlab_issue', 'source_github_issue', 'source_jira_issue'] as const
export const createTask = async (sql: Sql, input: CreateTaskInput): Promise<Task> => {
  const presentCols = filterPresentColumns(input, createTaskCols)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    RETURNING *
  `)
  if (!task) {
    throw new Error('Failed to create task')
  }
  return task
}

const updateTaskCols = ['title', 'description', 'status', 'remote_status', 'project_id', 'task_source_id', 'source_gitlab_issue', 'source_github_issue', 'source_jira_issue', 'ai_evaluation_status', 'ai_evaluation_session_id', 'ai_evaluation_result', 'ai_evaluation_simple_result', 'ai_evaluation_agentic_result', 'ai_implementation_status', 'ai_implementation_session_id'] as const

export const updateTask = async (sql: Sql, id: string, input: UpdateTaskInput): Promise<Result<Task>> => {
  const presentCols = filterPresentColumns(input, updateTaskCols)

  if (presentCols.length === 0) {
    // If no columns to update, just update the timestamp
    const tasks = await get(sql<Task[]>`
      UPDATE tasks
      SET updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `)
    const [task] = tasks
    return task
      ? { ok: true, data: task }
      : { ok: false, error: 'Task not found' }
  }

  // Build update object with only present columns
  const updateData: Record<string, unknown> = {}
  for (const col of presentCols) {
    updateData[col] = input[col as keyof UpdateTaskInput]
  }

  const tasks = await get(sql<Task[]>`
    UPDATE tasks
    SET ${sql(updateData)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

export const deleteTask = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM tasks WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Task not found' }
}

const upsertTaskCols = ['title', 'description', 'status', 'remote_status', 'project_id', 'task_source_id', 'source_gitlab_issue', 'source_github_issue', 'source_jira_issue'] as const
export const upsertTaskFromGitlab = async (sql: Sql, input: CreateTaskInput): Promise<Task> => {
  const presentCols = filterPresentColumns(input, upsertTaskCols)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    ON CONFLICT (task_source_id, (source_gitlab_issue->>'id'))
    WHERE source_gitlab_issue IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      remote_status = EXCLUDED.remote_status,
      source_gitlab_issue = EXCLUDED.source_gitlab_issue,
      updated_at = NOW()
    RETURNING *
  `)
  if (!task) {
    throw new Error('Failed to upsert task')
  }
  return task
}

export const upsertTaskFromGithub = async (sql: Sql, input: CreateTaskInput): Promise<Task> => {
  const presentCols = filterPresentColumns(input, upsertTaskCols)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    ON CONFLICT (task_source_id, (source_github_issue->>'id'))
    WHERE source_github_issue IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      remote_status = EXCLUDED.remote_status,
      source_github_issue = EXCLUDED.source_github_issue,
      updated_at = NOW()
    RETURNING *
  `)
  if (!task) {
    throw new Error('Failed to upsert task')
  }
  return task
}

export const upsertTaskFromJira = async (sql: Sql, input: CreateTaskInput): Promise<Task> => {
  const presentCols = filterPresentColumns(input, upsertTaskCols)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    ON CONFLICT (task_source_id, (source_jira_issue->>'id'))
    WHERE source_jira_issue IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      remote_status = EXCLUDED.remote_status,
      source_jira_issue = EXCLUDED.source_jira_issue,
      updated_at = NOW()
    RETURNING *
  `)
  if (!task) {
    throw new Error('Failed to upsert task')
  }
  return task
}

/**
 * Update task evaluation status
 */
export const updateTaskEvaluationStatus = async (
  sql: Sql,
  taskId: string,
  status: 'pending' | 'queued' | 'evaluating' | 'completed' | 'failed',
  sessionId?: string
): Promise<Result<Task>> => {
  const tasks = await get(sql<Task[]>`
    UPDATE tasks
    SET
      ai_evaluation_status = ${status},
      ai_evaluation_session_id = ${sessionId || null},
      updated_at = NOW()
    WHERE id = ${taskId}
    RETURNING *
  `)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

/**
 * Update task evaluation result
 * Sets the outcome of evaluation (ready or needs_clarification)
 */
export const updateTaskEvaluationResult = async (
  sql: Sql,
  taskId: string,
  result: 'ready' | 'needs_clarification'
): Promise<Result<Task>> => {
  const tasks = await get(sql<Task[]>`
    UPDATE tasks
    SET
      ai_evaluation_result = ${result},
      updated_at = NOW()
    WHERE id = ${taskId}
    RETURNING *
  `)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

/**
 * Update task simple evaluation result
 * Stores the result from the simple/quick evaluation filter
 */
export const updateTaskEvaluationSimpleResult = async (
  sql: Sql,
  taskId: string,
  simpleResult: unknown
): Promise<Result<Task>> => {
  const tasks = await get(sql<Task[]>`
    UPDATE tasks
    SET
      ai_evaluation_simple_result = ${sql.json(simpleResult as any)},
      updated_at = NOW()
    WHERE id = ${taskId}
    RETURNING *
  `)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

/**
 * Update task agentic evaluation result
 * Stores the result from the deep/agentic evaluation
 */
export const updateTaskEvaluationAgenticResult = async (
  sql: Sql,
  taskId: string,
  agenticResult: unknown
): Promise<Result<Task>> => {
  const tasks = await get(sql<Task[]>`
    UPDATE tasks
    SET
      ai_evaluation_agentic_result = ${sql.json(agenticResult as any)},
      updated_at = NOW()
    WHERE id = ${taskId}
    RETURNING *
  `)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

/**
 * Find tasks needing evaluation
 */
export const findTasksNeedingEvaluation = async (sql: Sql): Promise<Task[]> => {
  return get(sql<Task[]>`
    SELECT * FROM tasks
    WHERE ai_evaluation_status IS NULL OR ai_evaluation_status = 'pending'
    ORDER BY created_at DESC
  `)
}

/**
 * Update task implementation status
 */
export const updateTaskImplementationStatus = async (
  sql: Sql,
  taskId: string,
  status: 'pending' | 'queued' | 'implementing' | 'completed' | 'failed',
  sessionId?: string
): Promise<Result<Task>> => {
  const tasks = await get(sql<Task[]>`
    UPDATE tasks
    SET
      ai_implementation_status = ${status},
      ai_implementation_session_id = ${sessionId || null},
      updated_at = NOW()
    WHERE id = ${taskId}
    RETURNING *
  `)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}
