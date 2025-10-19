import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { WorkerRepository, CreateWorkerRepositoryInput, UpdateWorkerRepositoryInput, Result } from '../backend/types'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllWorkerRepositories = async (sql: Sql): Promise<WorkerRepository[]> => {
  return get(sql<WorkerRepository[]>`SELECT * FROM worker_repositories ORDER BY created_at DESC`)
}

export const findWorkerRepositoryById = async (sql: Sql, id: string): Promise<Result<WorkerRepository>> => {
  const repos = await get(sql<WorkerRepository[]>`SELECT * FROM worker_repositories WHERE id = ${id}`)
  const [repo] = repos
  return repo
    ? { ok: true, data: repo }
    : { ok: false, error: 'Worker repository not found' }
}

export const findWorkerRepositoryByProjectId = async (sql: Sql, projectId: string): Promise<Result<WorkerRepository>> => {
  const repos = await get(sql<WorkerRepository[]>`SELECT * FROM worker_repositories WHERE project_id = ${projectId}`)
  const [repo] = repos
  return repo
    ? { ok: true, data: repo }
    : { ok: false, error: 'Worker repository not found for project' }
}

const createWorkerRepositoryCols = ['project_id', 'source_gitlab', 'current_version'] as const
export const createWorkerRepository = async (sql: Sql, input: CreateWorkerRepositoryInput): Promise<WorkerRepository> => {
  const [repo] = await get(sql<WorkerRepository[]>`
    INSERT INTO worker_repositories ${sql(input, createWorkerRepositoryCols)}
    RETURNING *
  `)
  if (!repo) {
    throw new Error('Failed to create worker repository')
  }
  return repo
}

const updateWorkerRepositoryCols = ['source_gitlab', 'current_version'] as const
export const updateWorkerRepository = async (sql: Sql, id: string, input: UpdateWorkerRepositoryInput): Promise<Result<WorkerRepository>> => {
  const repos = await get(sql<WorkerRepository[]>`
    UPDATE worker_repositories
    SET ${sql(input, updateWorkerRepositoryCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [repo] = repos
  return repo
    ? { ok: true, data: repo }
    : { ok: false, error: 'Worker repository not found' }
}

export const deleteWorkerRepository = async (sql: Sql, id: string): Promise<Result<void>> => {
  const resultSet = await get(sql`DELETE FROM worker_repositories WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  return deleted
    ? { ok: true, data: undefined }
    : { ok: false, error: 'Worker repository not found' }
}
