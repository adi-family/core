import type { Sql } from 'postgres'
import type { Task, CreateTaskInput, UpdateTaskInput, Result } from '../types'

export const findAllTasks = (sql: Sql) => async (): Promise<Task[]> =>
  await sql<Task[]>`SELECT * FROM tasks ORDER BY created_at DESC`

export const findTaskById = (sql: Sql) => async (id: string): Promise<Result<Task>> => {
  const [task] = await sql<Task[]>`SELECT * FROM tasks WHERE id = ${id}`
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

export const createTask = (sql: Sql) => async (input: CreateTaskInput): Promise<Task> => {
  const [task] = await sql<Task[]>`
    INSERT INTO tasks ${sql(input, 'title', 'description', 'status', 'source_gitlab_issue', 'source_github_issue', 'source_jira_issue')}
    RETURNING *
  `
  return task
}

export const updateTask = (sql: Sql) => async (id: string, input: UpdateTaskInput): Promise<Result<Task>> => {
  const [task] = await sql<Task[]>`
    UPDATE tasks
    SET ${sql(input)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return task
    ? { ok: true, data: task }
    : { ok: false, error: 'Task not found' }
}

export const deleteTask = (sql: Sql) => async (id: string): Promise<Result<void>> => {
  const result = await sql`DELETE FROM tasks WHERE id = ${id}`
  return result.count > 0
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Task not found' }
}
