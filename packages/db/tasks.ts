import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Task, CreateTaskInput, UpdateTaskInput, Result } from '@types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllTasks = async (sql: Sql): Promise<Task[]> => {
  return get(sql<Task[]>`SELECT * FROM tasks ORDER BY created_at DESC`)
}

export const findTaskById = async (sql: Sql, id: string): Promise<Result<Task>> => {
  const tasks = await get(sql<Task[]>`SELECT * FROM tasks WHERE id = ${id}`)
  const [task] = tasks
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

const createTaskCols = ['title', 'description', 'status', 'project_id', 'task_source_id', 'source_gitlab_issue', 'source_github_issue', 'source_jira_issue'] as const
export const createTask = async (sql: Sql, input: CreateTaskInput): Promise<Task> => {
  // Only include columns that actually exist in the input to avoid undefined values
  const presentCols = createTaskCols.filter(col => col in input)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    RETURNING *
  `)
  if (!task) {
    throw new Error('Failed to create task')
  }
  return task
}

const updateTaskCols = ['title', 'description', 'status', 'project_id', 'task_source_id', 'source_gitlab_issue', 'source_github_issue', 'source_jira_issue'] as const
export const updateTask = async (sql: Sql, id: string, input: UpdateTaskInput): Promise<Result<Task>> => {
  // Only include columns that actually exist in the input to avoid undefined values
  const presentCols = updateTaskCols.filter(col => col in input)

  const tasks = await get(sql<Task[]>`
    UPDATE tasks
    SET ${sql(input, presentCols)}, updated_at = NOW()
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

const upsertTaskCols = ['title', 'description', 'status', 'project_id', 'task_source_id', 'source_gitlab_issue', 'source_github_issue', 'source_jira_issue'] as const
export const upsertTaskFromGitlab = async (sql: Sql, input: CreateTaskInput): Promise<Task> => {
  const presentCols = upsertTaskCols.filter(col => col in input)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    ON CONFLICT (task_source_id, (source_gitlab_issue->>'id'))
    WHERE source_gitlab_issue IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
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
  const presentCols = upsertTaskCols.filter(col => col in input)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    ON CONFLICT (task_source_id, (source_github_issue->>'id'))
    WHERE source_github_issue IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
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
  const presentCols = upsertTaskCols.filter(col => col in input)

  const [task] = await get(sql<Task[]>`
    INSERT INTO tasks ${sql(input, presentCols)}
    ON CONFLICT (task_source_id, (source_jira_issue->>'id'))
    WHERE source_jira_issue IS NOT NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      source_jira_issue = EXCLUDED.source_jira_issue,
      updated_at = NOW()
    RETURNING *
  `)
  if (!task) {
    throw new Error('Failed to upsert task')
  }
  return task
}
