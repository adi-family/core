/**
 * Project handlers using secured ACL-based access control
 *
 * Pattern:
 *   await ctx.acl.project(id).viewer()
 *   const project = await queries.findProjectById(ctx.sql, id)
 */

import type { Sql } from 'postgres'
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
import { validateAIProviderConfig } from '../services/ai-provider-validator'
import { createSecuredHandlers } from '../utils/auth'
import type { AnthropicConfig, OpenAIConfig, GoogleConfig } from '@types'

export function createProjectHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  const listProjects = handler(listProjectsConfig, async (ctx) => {
    const projectIds = await ctx.acl.accessibleProjectIds()
    const allProjects = await queries.findAllProjects(ctx.sql)
    return allProjects.filter(p => projectIds.includes(p.id))
  })

  const getProject = handler(getProjectConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).viewer()
    return queries.findProjectById(ctx.sql, id)
  })

  const getProjectStats = handler(getProjectStatsConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).viewer()
    return queries.getProjectStats(ctx.sql, id)
  })

  const createProject = handler(createProjectConfig, async (ctx) => {
    const { name, enabled } = ctx.body

    const project = await queries.createProject(ctx.sql, {
      name,
      ...(enabled !== undefined && { enabled })
    })

    await userAccessQueries.grantAccess(ctx.sql, {
      user_id: ctx.userId,
      entity_type: 'project',
      entity_id: project.id,
      role: 'owner',
      granted_by: ctx.userId,
    })

    return project
  })

  const updateProject = handler(updateProjectConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).admin()
    return queries.updateProject(ctx.sql, id, ctx.body)
  })

  const deleteProject = handler(deleteProjectConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).owner()
    await queries.deleteProject(ctx.sql, id)
    return { success: true }
  })

  const getProjectAIProviders = handler(getProjectAIProvidersConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).viewer()
    return queries.getProjectAIProviderConfigs(ctx.sql, id)
  })

  const updateProjectAIProvider = handler(updateProjectAIProviderConfig, async (ctx) => {
    const { id, provider } = ctx.params
    const config = ctx.body

    if (!['anthropic', 'openai', 'google'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    const apiKeySecretId = config.api_key_secret_id
    if (!apiKeySecretId) {
      throw new Error('API key secret ID is required')
    }

    await ctx.acl.project(id).admin()

    const secret = await secretQueries.findSecretById(ctx.sql, apiKeySecretId)
    if (secret.project_id !== id) {
      throw new Error('Secret does not belong to this project')
    }

    await queries.setProjectAIProviderConfig(
      ctx.sql,
      id,
      provider as 'anthropic' | 'openai' | 'google',
      config
    )

    return await queries.getProjectAIProviderConfigs(ctx.sql, id) || {}
  })

  const deleteProjectAIProvider = handler(deleteProjectAIProviderConfig, async (ctx) => {
    const { id, provider } = ctx.params

    if (!['anthropic', 'openai', 'google'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    await ctx.acl.project(id).admin()
    await queries.removeProjectAIProviderConfig(ctx.sql, id, provider as 'anthropic' | 'openai' | 'google')
    return { success: true }
  })

  const validateProjectAIProvider = handler(validateProjectAIProviderConfig, async (ctx) => {
    const { id, provider } = ctx.params
    const config = ctx.body

    if (!['anthropic', 'openai', 'google'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`)
    }

    // For validation, api_key is passed in the config body (not in the schema)
    const apiKey = (config as Record<string, unknown>).api_key as string | undefined
    if (!apiKey) {
      throw new Error('API key is required for validation')
    }

    await ctx.acl.project(id).viewer()

    return validateAIProviderConfig(
      provider as 'anthropic' | 'openai' | 'google',
      config as AnthropicConfig | OpenAIConfig | GoogleConfig,
      apiKey
    )
  })

  const getProjectGitLabExecutor = handler(getProjectGitLabExecutorConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).viewer()
    return queries.getProjectJobExecutor(ctx.sql, id)
  })

  const createProjectGitLabExecutor = handler(createProjectGitLabExecutorConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).admin()
    await queries.setProjectJobExecutor(ctx.sql, id, ctx.body)
    return ctx.body
  })

  const deleteProjectGitLabExecutor = handler(deleteProjectGitLabExecutorConfig, async (ctx) => {
    const { id } = ctx.params
    await ctx.acl.project(id).admin()
    await queries.removeProjectJobExecutor(ctx.sql, id)
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
