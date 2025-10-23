import type {MaybeRow, PendingQuery, Sql} from 'postgres'
import type { Project, CreateProjectInput, UpdateProjectInput, Result, GitlabExecutorConfig, AIProviderConfig, AnthropicConfig, OpenAIConfig, GoogleConfig } from '@types'
import { filterPresentColumns } from './utils'

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
  const presentCols = filterPresentColumns(input, updateProjectCols)

  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET ${sql(input, presentCols)}, updated_at = NOW()
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

/**
 * Set job executor GitLab configuration for a project
 */
export const setProjectJobExecutor = async (
  sql: Sql,
  projectId: string,
  config: GitlabExecutorConfig
): Promise<Result<Project>> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      job_executor_gitlab = ${sql.json(config)},
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  return project
    ? { ok: true, data: project }
    : { ok: false, error: 'Project not found' }
}

/**
 * Remove job executor GitLab configuration from a project
 */
export const removeProjectJobExecutor = async (
  sql: Sql,
  projectId: string
): Promise<Result<Project>> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      job_executor_gitlab = NULL,
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  return project
    ? { ok: true, data: project }
    : { ok: false, error: 'Project not found' }
}

/**
 * Get project's job executor configuration
 * Returns null if not set
 */
export const getProjectJobExecutor = async (
  sql: Sql,
  projectId: string
): Promise<Result<GitlabExecutorConfig | null>> => {
  const projectResult = await findProjectById(sql, projectId)
  if (!projectResult.ok) {
    return { ok: false, error: projectResult.error }
  }
  return {
    ok: true,
    data: projectResult.data.job_executor_gitlab
  }
}

/**
 * Get project's AI provider configurations
 * Returns null if not set
 */
export const getProjectAIProviderConfigs = async (
  sql: Sql,
  projectId: string
): Promise<Result<AIProviderConfig | null>> => {
  const projectResult = await findProjectById(sql, projectId)
  if (!projectResult.ok) {
    return { ok: false, error: projectResult.error }
  }
  return {
    ok: true,
    data: projectResult.data.ai_provider_configs
  }
}

/**
 * Set AI provider configuration for a project
 */
export const setProjectAIProviderConfig = async (
  sql: Sql,
  projectId: string,
  provider: 'anthropic' | 'openai' | 'google',
  config: AnthropicConfig | OpenAIConfig | GoogleConfig
): Promise<Result<Project>> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      ai_provider_configs = COALESCE(ai_provider_configs, '{}'::jsonb) || jsonb_build_object(${provider}, ${sql.json(config)}),
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  return project
    ? { ok: true, data: project }
    : { ok: false, error: 'Project not found' }
}

/**
 * Remove AI provider configuration from a project
 */
export const removeProjectAIProviderConfig = async (
  sql: Sql,
  projectId: string,
  provider: 'anthropic' | 'openai' | 'google'
): Promise<Result<Project>> => {
  const projects = await get(sql<Project[]>`
    UPDATE projects
    SET
      ai_provider_configs = ai_provider_configs - ${provider},
      updated_at = NOW()
    WHERE id = ${projectId}
    RETURNING *
  `)
  const [project] = projects
  return project
    ? { ok: true, data: project }
    : { ok: false, error: 'Project not found' }
}

/**
 * Get specific AI provider configuration for a project
 */
export const getProjectAIProviderConfig = async (
  sql: Sql,
  projectId: string,
  provider: 'anthropic' | 'openai' | 'google'
): Promise<Result<AnthropicConfig | OpenAIConfig | GoogleConfig | null>> => {
  const projectResult = await findProjectById(sql, projectId)
  if (!projectResult.ok) {
    return { ok: false, error: projectResult.error }
  }

  const config = projectResult.data.ai_provider_configs
  if (!config) {
    return { ok: true, data: null }
  }

  const providerConfig = config[provider]
  return {
    ok: true,
    data: providerConfig || null
  }
}
