import type { Sql } from 'postgres'
import type { WorkerRepository, CreateWorkerRepositoryInput, UpdateWorkerRepositoryInput } from '@types'
import { filterPresentColumns, get, findOneById } from './utils'
import { NotFoundException } from '../utils/exceptions'

export const findAllWorkerRepositories = async (sql: Sql): Promise<WorkerRepository[]> => {
  return get(sql<WorkerRepository[]>`SELECT * FROM worker_repositories ORDER BY created_at DESC`)
}

export const findWorkerRepositoryById = async (sql: Sql, id: string): Promise<WorkerRepository> => {
  return findOneById<WorkerRepository>(sql, 'worker_repositories', id, 'Worker repository')
}

export const findWorkerRepositoryByProjectId = async (sql: Sql, projectId: string): Promise<WorkerRepository> => {
  const repos = await get(sql<WorkerRepository[]>`SELECT * FROM worker_repositories WHERE project_id = ${projectId}`)
  const [repo] = repos
  if (!repo) {
    throw new NotFoundException('Worker repository not found for project')
  }
  return repo
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
export const updateWorkerRepository = async (sql: Sql, id: string, input: UpdateWorkerRepositoryInput): Promise<WorkerRepository> => {
  const presentCols = filterPresentColumns(input, updateWorkerRepositoryCols)

  const repos = await get(sql<WorkerRepository[]>`
    UPDATE worker_repositories
    SET ${sql(input, presentCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [repo] = repos
  if (!repo) {
    throw new NotFoundException('Worker repository not found')
  }
  return repo
}

export const deleteWorkerRepository = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM worker_repositories WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('Worker repository not found')
  }
}

interface WorkerRepoWithProject {
  id: string
  project_id: string
  project_name: string
  source_gitlab: any
  current_version: string
}

export const findWorkerRepositoriesWithProjects = async (sql: Sql): Promise<WorkerRepoWithProject[]> => {
  return get(sql<WorkerRepoWithProject[]>`
    SELECT
      wr.id,
      wr.project_id,
      wr.source_gitlab,
      wr.current_version,
      p.name as project_name
    FROM worker_repositories wr
    JOIN projects p ON p.id = wr.project_id
    ORDER BY p.name
  `)
}

interface WorkerRepoStatus {
  id: string
  project_id: string
  current_version: string
  gitlab_path: string
  gitlab_host: string
  updated_at: Date
  project_name: string
}

export const findWorkerRepositoryStatus = async (sql: Sql): Promise<WorkerRepoStatus[]> => {
  return get(sql<WorkerRepoStatus[]>`
    SELECT
      wr.id,
      wr.project_id,
      wr.current_version,
      wr.source_gitlab->>'project_path' as gitlab_path,
      wr.source_gitlab->>'host' as gitlab_host,
      wr.updated_at,
      p.name as project_name
    FROM worker_repositories wr
    JOIN projects p ON p.id = wr.project_id
    ORDER BY p.name
  `)
}

interface ProjectWithoutRepo {
  id: string
  name: string
}

export const findProjectsWithoutWorkerRepositories = async (sql: Sql): Promise<ProjectWithoutRepo[]> => {
  return get(sql<ProjectWithoutRepo[]>`
    SELECT p.id, p.name
    FROM projects p
    LEFT JOIN worker_repositories wr ON wr.project_id = p.id
    WHERE wr.id IS NULL
    ORDER BY p.name
  `)
}
