/**
 * Project handlers using new @utils/http system
 * Uses factory pattern to inject dependencies
 */

import type { Sql } from 'postgres'
import { handler, type HandlerContext } from '@adi-family/http'
import {
  listProjectsConfig,
  getProjectConfig,
  createProjectConfig,
  updateProjectConfig,
  deleteProjectConfig,
  getProjectStatsConfig,
  getProjectAIProvidersConfig,
  updateProjectAIProviderConfig,
  deleteProjectAIProviderConfig,
  validateProjectAIProviderConfig,
  getProjectGitLabExecutorConfig,
  createProjectGitLabExecutorConfig,
  deleteProjectGitLabExecutorConfig
} from '@adi/api-contracts/projects'
import * as queries from '../../db/projects'
import * as userAccessQueries from '../../db/user-access'
import * as secretQueries from '../../db/secrets'
import { ENCRYPTION_KEY } from '../config'
import { validateAIProviderConfig } from '../services/ai-provider-validator'
import { getUserIdFromClerkToken, requireProjectAccess } from '../utils/auth'
import type { AnthropicConfig, OpenAIConfig, GoogleConfig } from '@types'

export function createProjectHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    return getUserIdFromClerkToken(ctx.headers.get('Authorization'))
  }

  /**
   * List all projects
   */
  const listProjects = handler(listProjectsConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
    const allProjects = await queries.findAllProjects(sql)
    const filtered = allProjects.filter(p => accessibleProjectIds.includes(p.id))

    return filtered
  })

  /**
   * Get project by ID
   */
  const getProject = handler(getProjectConfig, async (ctx) => {
    const { id } = ctx.params
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id)

    const project = await queries.findProjectById(sql, id)

    return project
  })

  /**
   * Get project stats
   */
  const getProjectStats = handler(getProjectStatsConfig, async (ctx) => {
    const { id } = ctx.params
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id)

    const stats = await queries.getProjectStats(sql, id)

    return stats
  })

  /**
   * Create new project
   */
  const createProject = handler(createProjectConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { name, enabled } = ctx.body

    const project = await queries.createProject(sql, {
      name,
      ...(enabled !== undefined && { enabled })
    })

    await userAccessQueries.grantAccess(sql, {
      user_id: userId,
      entity_type: 'project',
      entity_id: project.id,
      role: 'owner',
      granted_by: userId,
    })

    return project
  })

  /**
   * Update project
   */
  const updateProject = handler(updateProjectConfig, async (ctx) => {
    const { id } = ctx.params
    const updates = ctx.body
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id, 'admin', 'Forbidden: You need admin role to update this project')

    const project = await queries.updateProject(sql, id, updates)

    return project
  })

  /**
   * Delete project
   */
  const deleteProject = handler(deleteProjectConfig, async (ctx) => {
    const { id } = ctx.params
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id, 'owner', 'Forbidden: You need owner role to delete this project')

    await queries.deleteProject(sql, id)

    return { success: true }
  })

  /**
   * Get AI provider configurations
   */
  const getProjectAIProviders = handler(getProjectAIProvidersConfig, async (ctx) => {
    const { id } = ctx.params
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id)

    const configs = await queries.getProjectAIProviderConfigs(sql, id)

    return configs
  })

  /**
   * Update AI provider configuration
   */
  const updateProjectAIProvider = handler(updateProjectAIProviderConfig, async (ctx) => {
    const { id, provider } = ctx.params
    const config = ctx.body
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id, 'admin', 'Forbidden: You need admin role to update AI provider configs')

    // Validate provider type
    if (!['anthropic', 'openai', 'google'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    // Verify that api_key_secret_id is provided
    const apiKeySecretId = (config as any).api_key_secret_id
    if (!apiKeySecretId) {
      throw new Error('API key secret ID is required')
    }

    // Verify the secret exists and belongs to this project
    const secret = await secretQueries.findSecretById(sql, apiKeySecretId)
    if (secret.project_id !== id) {
      throw new Error('Secret does not belong to this project')
    }

    // Save the config to the database
    await queries.setProjectAIProviderConfig(
      sql,
      id,
      provider as 'anthropic' | 'openai' | 'google',
      config as any
    )

    // Get the updated configs
    const updatedConfigs = await queries.getProjectAIProviderConfigs(sql, id)

    return updatedConfigs || {}
  })

  /**
   * Delete AI provider configuration
   */
  const deleteProjectAIProvider = handler(deleteProjectAIProviderConfig, async (ctx) => {
    const { id, provider } = ctx.params
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id, 'admin', 'Forbidden: You need admin role to delete AI provider configs')

    // Validate provider type
    if (!['anthropic', 'openai', 'google'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    await queries.removeProjectAIProviderConfig(
      sql,
      id,
      provider as 'anthropic' | 'openai' | 'google'
    )

    return { success: true }
  })

  /**
   * Validate AI provider configuration
   */
  const validateProjectAIProvider = handler(validateProjectAIProviderConfig, async (ctx) => {
    const { id, provider } = ctx.params
    const config = ctx.body
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id)

    // Validate provider type
    if (!['anthropic', 'openai', 'google'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    // Extract api_key from config
    const apiKey = (config as any).api_key
    if (!apiKey) {
      throw new Error('API key is required for validation')
    }

    // Validate the config
    const result = await validateAIProviderConfig(
      provider as 'anthropic' | 'openai' | 'google',
      config as AnthropicConfig | OpenAIConfig | GoogleConfig,
      apiKey
    )

    return result
  })

  /**
   * Get GitLab executor configuration
   */
  const getProjectGitLabExecutor = handler(getProjectGitLabExecutorConfig, async (ctx) => {
    const { id } = ctx.params
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id)

    const config = await queries.getProjectJobExecutor(sql, id)

    return config
  })

  /**
   * Create/Update GitLab executor configuration
   */
  const createProjectGitLabExecutor = handler(createProjectGitLabExecutorConfig, async (ctx) => {
    const { id } = ctx.params
    const config = ctx.body
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id, 'admin', 'Forbidden: You need admin role to update GitLab executor config')

    await queries.setProjectJobExecutor(sql, id, config)

    return config
  })

  /**
   * Delete GitLab executor configuration
   */
  const deleteProjectGitLabExecutor = handler(deleteProjectGitLabExecutorConfig, async (ctx) => {
    const { id } = ctx.params
    const userId = await getUserId(ctx)

    await requireProjectAccess(sql, userId, id, 'admin', 'Forbidden: You need admin role to delete GitLab executor config')

    await queries.removeProjectJobExecutor(sql, id)

    return { success: true }
  })

  return {
    listProjects,
    getProject,
    getProjectStats,
    createProject,
    updateProject,
    deleteProject,
    getProjectAIProviders,
    updateProjectAIProvider,
    deleteProjectAIProvider,
    validateProjectAIProvider,
    getProjectGitLabExecutor,
    createProjectGitLabExecutor,
    deleteProjectGitLabExecutor
  }
}
