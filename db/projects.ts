import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Project, CreateProjectInput, UpdateProjectInput, Result } from '../types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllProjects = async (sql: Sql): Promise<Project[]> => {
  return get(sql<Project[]>`SELECT * FROM projects ORDER BY created_at DESC`)
}

export const findProjectById = async (sql: Sql, id: string): Promise<Result<Project>> => {
  const projects = await get(sql<Project[]>`SELECT * FROM projects WHERE id = ${id}`)
  const [project] = projects
  return project
    ? { ok: true, data: project }
    : { ok: false, error: 'Project not found' }
}

const createProjectCols = ['name', 'enabled'] as const
export const createProject = async (sql: Sql, input: CreateProjectInput): Promise<Project> => {
  const [project] = await get(sql<Project[]>`
    INSERT INTO projects ${sql(input, createProjectCols)}
    RETURNING *
  `)
  if (!project) {
    throw new Error('Failed to create project')
  }
  return project
}

const updateProjectCols = ['name', 'enabled'] as const
export const updateProject = async (sql: Sql, id: string, input: UpdateProjectInput): Promise<Result<Project>> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET ${sql(input, updateProjectCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [project] = projects
  return project
    ? { ok: true, data: project }
    : { ok: false, error: 'Project not found' }
}

export const deleteProject = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM projects WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Project not found' }
}
