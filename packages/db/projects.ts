import type { MaybeRow, PendingQuery, Sql } from 'postgres'
import type { Project, CreateProjectInput, UpdateProjectInput, GitlabExecutorConfig, AIProviderConfig, AnthropicConfig, OpenAIConfig, GoogleConfig } from '@types'
import { filterPresentColumns } from './utils'
import { NotFoundException } from '../utils/exceptions'

function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

export const findAllProjects = async (sql: Sql): Promise<Project[]> => {
  return get(sql<Project[]>`SELECT * FROM projects ORDER BY created_at DESC`)
}

export const findProjectById = async (sql: Sql, id: string): Promise<Project> => {
  const projects = await get(sql<Project[]>`SELECT * FROM projects WHERE id = ${id}`)
  const [project] = projects
  if (!project) {
    throw new NotFoundException('Project not found')
  }
  return project
}

const createProjectCols = ['name', 'enabled'] as const
export const createProject = async (sql: Sql, input: CreateProjectInput): Promise<Project> => {
  const presentCols = filterPresentColumns(input, createProjectCols)

  const [project] = await get(sql<Project[]>`
    INSERT INTO projects ${sql(input, presentCols)}
    RETURNING *
  `)
  if (!project) {
    throw new Error('Failed to create project')
  }
  return project
}

const updateProjectCols = ['name', 'enabled'] as const
export const updateProject = async (sql: Sql, id: string, input: UpdateProjectInput): Promise<Project> => {
  const presentCols = filterPresentColumns(input, updateProjectCols)

  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET ${sql(input, presentCols)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `)
  const [project] = projects
  if (!project) {
    throw new NotFoundException('Project not found')
  }
  return project
}

export const deleteProject = async (sql: Sql, id: string): Promise<void> => {
  const resultSet = await get(sql`DELETE FROM projects WHERE id = ${id}`)
  const deleted = resultSet.count > 0
  if (!deleted) {
    throw new NotFoundException('Project not found')
  }
}

/**
 * Set job executor GitLab configuration for a project
 */
export const setProjectJobExecutor = async (
  sql: Sql,
  projectId: string,
  config: GitlabExecutorConfig
): Promise<Project> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      job_executor_gitlab = ${sql.json(config)},
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  if (!project) {
    throw new NotFoundException('Project not found')
  }
  return project
}

/**
 * Remove job executor GitLab configuration from a project
 */
export const removeProjectJobExecutor = async (
  sql: Sql,
  projectId: string
): Promise<Project> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      job_executor_gitlab = NULL,
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  if (!project) {
    throw new NotFoundException('Project not found')
  }
  return project
}

/**
 * Get project's job executor configuration
 * Returns null if not set
 */
export const getProjectJobExecutor = async (
  sql: Sql,
  projectId: string
): Promise<GitlabExecutorConfig | null> => {
  const project = await findProjectById(sql, projectId)
  return project.job_executor_gitlab
}

/**
 * Get project's AI provider configurations
 * Returns null if not set
 */
export const getProjectAIProviderConfigs = async (
  sql: Sql,
  projectId: string
): Promise<AIProviderConfig | null> => {
  const project = await findProjectById(sql, projectId)
  return project.ai_provider_configs
}

/**
 * Set AI provider configuration for a project
 */
export const setProjectAIProviderConfig = async (
  sql: Sql,
  projectId: string,
  provider: 'anthropic' | 'openai' | 'google',
  config: AnthropicConfig | OpenAIConfig | GoogleConfig
): Promise<Project> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      ai_provider_configs = COALESCE(ai_provider_configs, '{}'::jsonb) || jsonb_build_object(${provider}::text, ${sql.json(config)}),
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  if (!project) {
    throw new NotFoundException('Project not found')
  }
  return project
}

/**
 * Remove AI provider configuration from a project
 */
export const removeProjectAIProviderConfig = async (
  sql: Sql,
  projectId: string,
  provider: 'anthropic' | 'openai' | 'google'
): Promise<Project> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      ai_provider_configs = ai_provider_configs - ${provider}::text,
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  if (!project) {
    throw new NotFoundException('Project not found')
  }
  return project
}

/**
 * Get specific AI provider configuration for a project
 */
export const getProjectAIProviderConfig = async (
  sql: Sql,
  projectId: string,
  provider: 'anthropic' | 'openai' | 'google'
): Promise<AnthropicConfig | OpenAIConfig | GoogleConfig | null> => {
  const project = await findProjectById(sql, projectId)
  const config = project.ai_provider_configs
  if (!config) {
    return null
  }

  const providerConfig = config[provider]
  return providerConfig || null
}

/**
 * Update project's last synced timestamp
 */
export const updateProjectLastSyncedAt = async (
  sql: Sql,
  projectId: string
): Promise<Project> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      last_synced_at = NOW(),
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  if (!project) {
    throw new NotFoundException('Project not found')
  }
  return project
}

/**
 * Get project statistics in a single SQL query
 */
export interface ProjectStats {
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  failed_tasks: number
  pending_tasks: number
  task_sources: number
  file_spaces: number
}

export const getProjectStats = async (
  sql: Sql,
  projectId: string
): Promise<ProjectStats> => {
  const [stats] = await get(sql<ProjectStats[]>`
    SELECT
      COALESCE(COUNT(DISTINCT t.id), 0)::int AS total_tasks,
      COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'completed'), 0)::int AS completed_tasks,
      COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'in_progress'), 0)::int AS in_progress_tasks,
      COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'failed'), 0)::int AS failed_tasks,
      COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending'), 0)::int AS pending_tasks,
      COALESCE(COUNT(DISTINCT ts.id), 0)::int AS task_sources,
      COALESCE(COUNT(DISTINCT fs.id), 0)::int AS file_spaces
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    LEFT JOIN task_sources ts ON ts.project_id = p.id
    LEFT JOIN file_spaces fs ON fs.project_id = p.id
    WHERE p.id = ${projectId}
    GROUP BY p.id
  `)

  // If project doesn't exist or has no data, return zeros
  return stats || {
    total_tasks: 0,
    completed_tasks: 0,
    in_progress_tasks: 0,
    failed_tasks: 0,
    pending_tasks: 0,
    task_sources: 0,
    file_spaces: 0
  }
}
