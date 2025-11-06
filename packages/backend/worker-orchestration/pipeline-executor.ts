/**
 * Pipeline Executor
 * Triggers GitLab CI pipelines for worker execution
 */

import type { Sql } from 'postgres'
import type { PipelineExecution, GitlabExecutorConfig, AIProviderConfig } from '@types'
import type { BackendClient } from '../api-client'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { retry, isRetryableError } from '@utils/retry'
import { createLogger } from '@utils/logger'
import { CIRepositoryManager } from '@worker/ci-repository-manager.ts'
import { validateGitLabSource, decryptGitLabToken, type GitLabSource } from './gitlab-utils'
import { getProjectOwnerId } from '@db/user-access'
import { checkQuotaAvailable, incrementQuotaUsage } from '@db/user-quotas'
import { findSessionById } from '@db/sessions'
import { findTaskById } from '@db/tasks'
import { findProjectById } from '@db/projects'
import { findWorkerRepositoryByProjectId, createWorkerRepository } from '@db/worker-repositories'
import { findSecretById } from '@db/secrets'
import { getPlatformAnthropicConfig } from '@backend/config'
import { checkProjectHasAnthropicProvider } from '@backend/services/ai-provider-selector'
import { getCachedPipelineApiKey } from '@backend/services/pipeline-api-key'
import { sql as defaultSql } from '@db/client'
import { getSessionConfig } from '@adi/api-contracts/sessions'
import { getTaskConfig } from '@adi/api-contracts/tasks'
import { getProjectConfig } from '@adi/api-contracts/projects'
import { getWorkerRepositoryByProjectConfig, createWorkerRepositoryConfig } from '@adi/api-contracts/worker-repositories'
import { getSecretValueConfig } from '@adi/api-contracts/secrets'
import { listFileSpacesConfig, getTaskFileSpacesConfig } from '@adi/api-contracts/file-spaces'
import { createPipelineExecutionConfig, updatePipelineExecutionConfig } from '@adi/api-contracts/pipeline-executions'

const logger = createLogger({ namespace: 'pipeline-executor' })

export interface TriggerPipelineInput {
  sessionId: string
  apiClient: BackendClient
}

export interface TriggerPipelineResult {
  execution: PipelineExecution
  pipelineUrl: string
}


interface PipelineContext {
  session: { id: string; task_id: string | null; runner: string | null }
  task: { id: string; project_id: string | null }
  project: { id: string; name: string; job_executor_gitlab: GitlabExecutorConfig | null; ai_provider_configs: AIProviderConfig | null }
  workerRepo: { id: string; current_version: string | null; source_gitlab: unknown }
  source: GitLabSource
  userId: string | null
}

/**
 * Auto-create worker repository if it doesn't exist
 */
async function ensureWorkerRepository(
  project: { id: string; name: string; job_executor_gitlab: GitlabExecutorConfig | null },
  apiClient: BackendClient,
  sql: Sql
): Promise<{ id: string; current_version: string | null; source_gitlab: unknown }> {
  try {
    // Fetch worker repository directly from database (bypass authentication)
    const workerRepo = await findWorkerRepositoryByProjectId(sql, project.id)

    try {
      const source = workerRepo.source_gitlab as unknown as GitLabSource
      if (source && source.type === 'gitlab' && source.project_id && source.host && source.access_token_encrypted) {
        const gitlabToken = decryptGitLabToken(source.access_token_encrypted)
        const gitlabClient = new GitLabApiClient(source.host, gitlabToken)

        await gitlabClient.enableExternalPipelineVariables(source.project_id)
        logger.info(`✓ Ensured external pipeline variables enabled for worker repository ${source.project_path}`)
      }
    } catch (error) {
      logger.warn(`⚠️  Could not update GitLab project settings for worker repository: ${error instanceof Error ? error.message : String(error)}`)
    }

    return workerRepo
  } catch {
    // Worker repository not found, proceed with auto-creation
  }

  logger.info(`Worker repository not found for project ${project.name}, auto-creating...`)

  let gitlabHost: string
  let gitlabToken: string
  let gitlabUser: string

  if (project.job_executor_gitlab) {
    const executor = project.job_executor_gitlab
    gitlabHost = executor.host

    // Fetch secret directly from database (bypass authentication)
    const secret = await findSecretById(sql, executor.access_token_secret_id)

    gitlabToken = secret.value

    const gitlabClient = new GitLabApiClient(gitlabHost, gitlabToken)
    const user = await gitlabClient.getCurrentUser()
    gitlabUser = user.username

    logger.info(`Using user-configured GitLab executor: ${gitlabHost} (user: ${gitlabUser})`)
  } else {
    // Use default environment credentials
    gitlabHost = process.env.GITLAB_HOST || ''
    gitlabToken = process.env.GITLAB_TOKEN || ''
    gitlabUser = process.env.GITLAB_USER || ''

    if (!gitlabHost || !gitlabToken || !gitlabUser) {
      throw new Error(
        `Worker repository not found for project ${project.name} and cannot auto-create: ` +
        `missing environment variables (GITLAB_HOST, GITLAB_TOKEN, GITLAB_USER) or project executor configuration. ` +
        `Please configure either project-level GitLab executor or set default environment variables.`
      )
    }

    logger.info(`Using default GitLab credentials: ${gitlabHost} (user: ${gitlabUser})`)
  }

  const manager = new CIRepositoryManager()
  const version = '2025-10-18-01'
  const customPath = `adi-worker-${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`

  const source = await manager.createWorkerRepository({
    projectName: project.name,
    sourceType: 'gitlab',
    host: gitlabHost,
    accessToken: gitlabToken,
    user: gitlabUser,
    customPath,
  })

  logger.info(`✓ Created GitLab repository: ${source.project_path}`)

  // Upload CI files
  await manager.uploadCIFiles({ source, version })
  logger.info(`✓ Uploaded CI files (version: ${version})`)

  // Save to database directly (bypass authentication)
  const workerRepo = await createWorkerRepository(sql, {
    project_id: project.id,
    source_gitlab: source as unknown,
    current_version: version,
  })

  logger.info(`✓ Worker repository auto-created: ${workerRepo.id}`)

  return workerRepo
}

/**
 * Check if workspace needs sync before pipeline execution
 * Returns error if file spaces were created after last sync
 */
async function checkWorkspaceSyncStatus(
  projectId: string,
  apiClient: BackendClient
): Promise<{ needsSync: boolean; reason?: string }> {
  try {
    // Fetch project to get last_synced_at
    const project = await apiClient.run(getProjectConfig, {
      params: { id: projectId }
    })

    // If never synced, workspace needs sync
    if (!project.last_synced_at) {
      return {
        needsSync: true,
        reason: 'Workspace has never been synced. Please add file spaces and wait for sync to complete.'
      }
    }

    // Fetch all file spaces for project
    try {
      const fileSpacesData = await apiClient.run(listFileSpacesConfig, {
        query: { project_id: projectId }
      })
      const fileSpaces = Array.isArray(fileSpacesData) ? fileSpacesData : (fileSpacesData as any).data || []

      // Check if any file space was created after last sync
      const lastSyncTime = new Date(project.last_synced_at).getTime()
      const newFileSpaces = fileSpaces.filter((fs: any) => {
        const createdTime = new Date(fs.created_at).getTime()
        return createdTime > lastSyncTime
      })

      if (newFileSpaces.length > 0) {
        const fsNames = newFileSpaces.map((fs: any) => fs.name).join(', ')
        return {
          needsSync: true,
          reason: `Workspace is outdated. ${newFileSpaces.length} file space(s) created after last sync: ${fsNames}. Please wait for workspace sync to complete.`
        }
      }
    } catch {
      // No file spaces configured
      return { needsSync: false }
    }

    return { needsSync: false }
  } catch (error) {
    logger.warn(`⚠️  Failed to check workspace sync status: ${error}`)
    return { needsSync: false } // Don't block pipeline on check failure
  }
}

/**
 * Wait for workspace sync to complete by polling the project's last_synced_at field
 * @param projectId Project ID to check
 * @param apiClient API client for backend calls
 * @param timeoutMs Maximum time to wait in milliseconds (default: 10 minutes)
 * @param pollIntervalMs How often to check for sync completion (default: 5 seconds)
 */
async function waitForWorkspaceSync(
  projectId: string,
  apiClient: BackendClient,
  timeoutMs: number = 10 * 60 * 1000, // 10 minutes
  pollIntervalMs: number = 5000 // 5 seconds
): Promise<void> {
  const startTime = Date.now()
  let iteration = 0

  logger.info(`⏳ Waiting for workspace sync to complete (timeout: ${timeoutMs / 1000}s)...`)

  while (Date.now() - startTime < timeoutMs) {
    iteration++

    // Check sync status
    const syncCheck = await checkWorkspaceSyncStatus(projectId, apiClient)

    if (!syncCheck.needsSync) {
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1)
      logger.info(`✅ Workspace sync completed after ${elapsedSeconds}s`)
      return
    }

    // Log progress every 10 iterations (50 seconds)
    if (iteration % 10 === 0) {
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(0)
      logger.info(`⏳ Still waiting for workspace sync... (${elapsedSeconds}s elapsed)`)
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
  }

  // Timeout reached
  throw new Error(
    `Workspace sync did not complete within ${timeoutMs / 1000} seconds. ` +
    `Please check the workspace sync status and try again.`
  )
}

/**
 * Validate and fetch all required context for pipeline execution
 */
async function validateAndFetchPipelineContext(apiClient: BackendClient, sessionId: string, sql: Sql): Promise<PipelineContext> {
  // Fetch session directly from database (bypass authentication)
  const session = await findSessionById(sql, sessionId)

  if (!session.task_id) {
    throw new Error(`Session ${sessionId} has no associated task. Please ensure the session is properly configured.`)
  }

  // Fetch task directly from database (bypass authentication)
  const task = await findTaskById(sql, session.task_id)

  if (!task.project_id) {
    throw new Error(`Task ${task.id} has no associated project. Please ensure the task is properly configured.`)
  }

  // Fetch project directly from database (bypass authentication)
  const project = await findProjectById(sql, task.project_id)

  // Get project owner for AI provider selection
  const userId = await getProjectOwnerId(sql, task.project_id)

  // Fetch or auto-create worker repository
  const workerRepo = await ensureWorkerRepository(project, apiClient, sql)
  const source = workerRepo.source_gitlab as unknown as GitLabSource

  // Validate source configuration
  if (source.type !== 'gitlab') {
    throw new Error(`Unsupported worker repository type: ${source.type}. Only 'gitlab' is currently supported.`)
  }

  validateGitLabSource(source)

  if (!workerRepo.current_version) {
    throw new Error(`Worker repository ${workerRepo.id} has no current version. Please upload CI files first.`)
  }

  if (!session.runner) {
    throw new Error(`Session ${session.id} has no runner type specified. Please ensure the session is properly configured.`)
  }

  return { session, task, project, workerRepo, source, userId }
}

/**
 * Get executor configuration (project-level or worker repository)
 */
async function getExecutorConfig(
  context: PipelineContext,
  apiClient: BackendClient
): Promise<{ host: string; accessToken: string; projectPath: string }> {
  // Check if project has custom executor configured
  if (context.project.job_executor_gitlab) {
    const executor = context.project.job_executor_gitlab
    logger.info(`Using project-specific GitLab executor: ${executor.host}`)

    // Fetch secret for access token with decrypted value
    const secret = await apiClient.run(getSecretValueConfig, {
      params: { id: executor.access_token_secret_id }
    })

    return {
      host: executor.host,
      accessToken: secret.value,
      projectPath: context.source.project_path!
    }
  }

  // Fall back to worker repository executor
  logger.info(`Using worker repository GitLab executor: ${context.source.host}`)

  const accessToken = decryptGitLabToken(context.source.access_token_encrypted!)

  return {
    host: context.source.host!,
    accessToken,
    projectPath: context.source.project_path!
  }
}

/**
 * Fetch and decrypt AI provider configurations and prepare environment variables
 */
/**
 * Context for AI provider environment variable setup
 */
interface AIProviderContext {
  projectId: string
  userId: string | null
  aiProviderConfigs: AIProviderConfig | null
  apiClient: BackendClient
  sql: Sql
}

/**
 * Fetch secret value from backend
 */
async function fetchSecretValue(secretId: string, apiClient: BackendClient): Promise<string | null> {
  try {
    const secret = await apiClient.run(getSecretValueConfig, {
      params: { id: secretId }
    })

    const value = secret.value

    if (!value || !value.trim()) {
      logger.warn(`⚠️  Secret ${secretId} exists but value is empty`)
      return null
    }

    return value
  } catch (error) {
    logger.warn(`⚠️  Failed to fetch secret ${secretId}: ${error}`)
    return null
  }
}

/**
 * Try to use platform Anthropic key with quota check
 */
async function tryUsePlatformAnthropicKey(
  userId: string,
  projectId: string,
  sql: Sql
): Promise<Record<string, string> | null> {
  try {
    const quotaCheck = await checkQuotaAvailable(sql, userId, 'implementation')

    if (quotaCheck.at_hard_limit) {
      const hasProjectKey = await checkProjectHasAnthropicProvider(sql, projectId)
      if (!hasProjectKey) {
        throw new Error(
          `Implementation quota exceeded (${quotaCheck.used}/${quotaCheck.hard_limit}). ` +
          `Please configure your own Anthropic API key in project settings to continue.`
        )
      }
      return null // Use project key instead
    }

    const platformConfig = getPlatformAnthropicConfig()
    if (!platformConfig) {
      logger.warn(`⚠️  No platform API key configured`)
      return null
    }

    const envVars: Record<string, string> = {
      ANTHROPIC_API_KEY: platformConfig.api_key
    }

    logger.info(`✓ Using platform Anthropic API key for implementation (${quotaCheck.used}/${quotaCheck.hard_limit})`)

    if (quotaCheck.at_soft_limit) {
      logger.warn(`⚠️  Implementation quota at soft limit (${quotaCheck.used}/${quotaCheck.hard_limit})`)
    }

    if (platformConfig.model) {
      envVars.ANTHROPIC_MODEL = platformConfig.model
    }
    if (platformConfig.max_tokens) {
      envVars.ANTHROPIC_MAX_TOKENS = platformConfig.max_tokens.toString()
    }
    if (platformConfig.temperature !== undefined) {
      envVars.ANTHROPIC_TEMPERATURE = platformConfig.temperature.toString()
    }

    return envVars
  } catch (error) {
    logger.warn(`⚠️  Could not check implementation quota: ${error}`)
    return null
  }
}

/**
 * Load Anthropic environment variables
 */
async function loadAnthropicEnvVars(
  config: AIProviderConfig['anthropic'],
  apiClient: BackendClient
): Promise<Record<string, string>> {
  const envVars: Record<string, string> = {}

  if (!config) return envVars

  const apiKey = await fetchSecretValue(config.api_key_secret_id, apiClient)
  if (!apiKey) return envVars

  envVars.ANTHROPIC_API_KEY = apiKey
  const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
  logger.info(`✓ Loaded ANTHROPIC_API_KEY from secret ${config.api_key_secret_id} (${maskedKey}, length: ${apiKey.length})`)

  if (config.type === 'self-hosted' && config.endpoint_url) {
    envVars.ANTHROPIC_API_URL = config.endpoint_url
    logger.info(`✓ Set ANTHROPIC_API_URL to ${config.endpoint_url}`)
  }

  if (config.model) {
    envVars.ANTHROPIC_MODEL = config.model
  }
  if (config.max_tokens) {
    envVars.ANTHROPIC_MAX_TOKENS = config.max_tokens.toString()
  }
  if (config.temperature !== undefined) {
    envVars.ANTHROPIC_TEMPERATURE = config.temperature.toString()
  }

  return envVars
}

/**
 * Load OpenAI environment variables
 */
async function loadOpenAIEnvVars(
  config: AIProviderConfig['openai'],
  apiClient: BackendClient
): Promise<Record<string, string>> {
  const envVars: Record<string, string> = {}

  if (!config) return envVars

  const apiKey = await fetchSecretValue(config.api_key_secret_id, apiClient)
  if (!apiKey) return envVars

  envVars.OPENAI_API_KEY = apiKey
  logger.info(`✓ Loaded OPENAI_API_KEY from secret ${config.api_key_secret_id}`)

  switch (config.type) {
    case 'azure':
      envVars.OPENAI_API_BASE = config.endpoint_url
      envVars.OPENAI_API_TYPE = 'azure'
      envVars.OPENAI_API_VERSION = config.api_version
      envVars.OPENAI_DEPLOYMENT_NAME = config.deployment_name
      logger.info(`✓ Configured Azure OpenAI with deployment ${config.deployment_name}`)
      break
    case 'self-hosted':
      envVars.OPENAI_API_BASE = config.endpoint_url
      logger.info(`✓ Set OPENAI_API_BASE to ${config.endpoint_url}`)
      break
    case 'cloud':
      if (config.organization_id) {
        envVars.OPENAI_ORGANIZATION = config.organization_id
      }
      break
  }

  if (config.model) {
    envVars.OPENAI_MODEL = config.model
  }

  return envVars
}

/**
 * Load Google environment variables
 */
async function loadGoogleEnvVars(
  config: AIProviderConfig['google'],
  apiClient: BackendClient
): Promise<Record<string, string>> {
  const envVars: Record<string, string> = {}

  if (!config) return envVars

  const apiKey = await fetchSecretValue(config.api_key_secret_id, apiClient)
  if (!apiKey) return envVars

  envVars.GOOGLE_API_KEY = apiKey
  logger.info(`✓ Loaded GOOGLE_API_KEY from secret ${config.api_key_secret_id}`)

  switch (config.type) {
    case 'vertex':
      envVars.GOOGLE_PROJECT_ID = config.project_id
      envVars.GOOGLE_LOCATION = config.location
      logger.info(`✓ Configured Vertex AI with project ${config.project_id} in ${config.location}`)
      break
    case 'self-hosted':
      envVars.GOOGLE_API_ENDPOINT = config.endpoint_url
      logger.info(`✓ Set GOOGLE_API_ENDPOINT to ${config.endpoint_url}`)
      break
    case 'cloud':
      // Cloud type doesn't need additional configuration
      break
  }

  if (config.model) {
    envVars.GOOGLE_MODEL = config.model
  }
  if (config.max_tokens) {
    envVars.GOOGLE_MAX_TOKENS = config.max_tokens.toString()
  }
  if (config.temperature !== undefined) {
    envVars.GOOGLE_TEMPERATURE = config.temperature.toString()
  }

  return envVars
}

/**
 * Get AI provider environment variables with quota checking
 */
async function getAIProviderEnvVars(context: AIProviderContext): Promise<Record<string, string>> {
  const { projectId, userId, aiProviderConfigs, apiClient, sql } = context

  // Try platform Anthropic key if user has quota and no project config
  if (userId && !aiProviderConfigs?.anthropic) {
    const platformEnvVars = await tryUsePlatformAnthropicKey(userId, projectId, sql)
    if (platformEnvVars) {
      return platformEnvVars
    }
  }

  if (!aiProviderConfigs) {
    return {}
  }

  try {
    const [anthropicVars, openaiVars, googleVars] = await Promise.all([
      loadAnthropicEnvVars(aiProviderConfigs.anthropic, apiClient),
      loadOpenAIEnvVars(aiProviderConfigs.openai, apiClient),
      loadGoogleEnvVars(aiProviderConfigs.google, apiClient)
    ])

    return { ...anthropicVars, ...openaiVars, ...googleVars }
  } catch (error) {
    logger.error(`❌ Failed to fetch AI provider configurations for project ${projectId}: ${error}`)
    return {}
  }
}

/**
 * Validate that required API keys are present for the pipeline runner type
 */
function validateRequiredApiKeys(
  runner: string | null,
  aiEnvVars: Record<string, string>
): void {
  if (!runner) {
    return // No validation needed if runner type is not specified
  }

  // Disable non-Claude runners
  const disabledRunners = ['codex', 'gemini']
  if (disabledRunners.includes(runner)) {
    throw new Error(
      `Cannot start ${runner} pipeline: This runner type is currently disabled. ` +
      `Only Claude-based runners (evaluation, claude) are supported.`
    )
  }

  const runnerKeyMap: Record<string, { key: string; provider: string }> = {
    'evaluation': { key: 'ANTHROPIC_API_KEY', provider: 'Anthropic (Claude)' },
    'claude': { key: 'ANTHROPIC_API_KEY', provider: 'Anthropic (Claude)' },
    'implementation': { key: 'ANTHROPIC_API_KEY', provider: 'Anthropic (Claude)' }, // Legacy support
  }

  const requirement = runnerKeyMap[runner]
  if (requirement && !aiEnvVars[requirement.key]) {
    throw new Error(
      `Cannot start ${runner} pipeline: Missing required API key for ${requirement.provider}. ` +
      `Please configure the ${requirement.provider} provider in your project settings with a valid API key.`
    )
  }
}

/**
 * Fetch access token for a file space
 */
async function fetchFileSpaceToken(
  apiClient: BackendClient,
  secretId: string,
  fileSpaceName: string
): Promise<string | undefined> {
  try {
    const secret = await apiClient.run(getSecretValueConfig, {
      params: { id: secretId }
    })
    logger.info(`✓ Access token loaded for ${fileSpaceName}`)
    return secret.value
  } catch (error) {
    logger.warn(`⚠️  Failed to load token for ${fileSpaceName}: ${error}`)
  }
  return undefined
}

/**
 * Build file space configuration from API response
 */
async function buildFileSpaceConfig(fileSpace: any, apiClient: BackendClient): Promise<any | null> {
  if (!fileSpace) {
    logger.warn('⚠️  File space is undefined, skipping')
    return null
  }

  const config = fileSpace.config as any
  if (!config.repo) {
    logger.warn(`⚠️  File space ${fileSpace.name} has no repo URL, skipping`)
    return null
  }

  const spaceConfig: any = {
    name: fileSpace.name,
    id: fileSpace.id,
    repo: config.repo,
    host: config.host
  }

  if (config.access_token_secret_id) {
    const token = await fetchFileSpaceToken(apiClient, config.access_token_secret_id, fileSpace.name)
    if (token) {
      spaceConfig.token = token
    }
  }

  logger.info(`✓ Configured file space: ${fileSpace.name} (${config.repo})`)
  return spaceConfig
}

/**
 * Load and configure file spaces for pipeline
 */
async function loadFileSpaces(
  apiClient: BackendClient,
  taskId: string,
  runnerType: string
): Promise<Record<string, string>> {
  logger.info(`🔍 Loading file spaces for task ${taskId}...`)

  try {
    const fileSpaces = await apiClient.run(getTaskFileSpacesConfig, {
      params: { id: taskId }
    })
    logger.info(`📦 API returned ${fileSpaces.length} file space(s) for task`)

    if (fileSpaces.length === 0) {
      logger.error(`❌ Task has no file spaces configured`)
      logger.error(`   ${runnerType} pipelines require at least one file space with code to analyze`)
      logger.error(`   Please configure file spaces for this task before running evaluation or implementation`)
      throw new Error(
        `Cannot run ${runnerType} pipeline: Task has no file spaces configured. ` +
        `Please add at least one file space with a repository URL to this task.`
      )
    }

    logger.info(`📦 Processing ${fileSpaces.length} file space(s)...`)
    const fileSpaceConfigs = []

    for (const fileSpace of fileSpaces) {
      const config = await buildFileSpaceConfig(fileSpace, apiClient)
      if (config) {
        fileSpaceConfigs.push(config)
      }
    }

    if (fileSpaceConfigs.length === 0) {
      logger.error(`❌ No valid file spaces after filtering`)
      logger.error(`   All file spaces are missing repository URLs`)
      logger.error(`   Each file space must have a 'repo' field in its config with a valid git repository URL`)
      throw new Error(
        `Cannot run ${runnerType} pipeline: All file spaces are missing repository URLs. ` +
        `Please ensure each file space has a 'repo' field configured with a valid git repository URL.`
      )
    }

    logger.info(`✓ ${fileSpaceConfigs.length} file space(s) will be cloned`)
    logger.info(`   FILE_SPACES variable will be passed to pipeline`)

    return { FILE_SPACES: JSON.stringify(fileSpaceConfigs) }
  } catch (error) {
    logger.warn(`⚠️  Failed to fetch file spaces: ${error}`)
    return {}
  }
}

/**
 * Get proxy environment variables if configured
 */
function getProxyVars(): Record<string, string> {
  if (process.env.PROXY_HOST && process.env.PROXY_USER && process.env.PROXY_PASS) {
    logger.info(`✓ Proxy configuration will be passed to pipeline: ${process.env.PROXY_HOST}`)
    return {
      PROXY_HOST: process.env.PROXY_HOST,
      PROXY_USER: process.env.PROXY_USER,
      PROXY_PASS: process.env.PROXY_PASS
    }
  }
  return {}
}

/**
 * Get mock mode environment variables if configured
 */
function getMockModeVars(): Record<string, string> {
  if (process.env.MOCK_MODE === 'true') {
    logger.info(`🎭 MOCK_MODE enabled - AI API calls will be mocked`)
    return { MOCK_MODE: 'true' }
  }
  return {}
}

/**
 * Log pipeline variables for debugging
 */
function logPipelineVariables(variables: Record<string, string>): void {
  logger.info(`🔍 DEBUG - Pipeline variables to be sent:`)
  logger.info(`  RUNNER_TYPE = ${variables.RUNNER_TYPE}`)
  logger.info(`  SESSION_ID = ${variables.SESSION_ID}`)
  logger.info(`  PIPELINE_EXECUTION_ID = ${variables.PIPELINE_EXECUTION_ID}`)

  if (variables.FILE_SPACES) {
    const fileSpaceCount = JSON.parse(variables.FILE_SPACES).length
    logger.info(`  FILE_SPACES = [${fileSpaceCount} workspace(s)]`)
  } else {
    logger.info(`  FILE_SPACES = not set`)
  }

  if (variables.MOCK_MODE) {
    logger.info(`  🎭 MOCK_MODE = ${variables.MOCK_MODE}`)
  }
}

/**
 * Prepare pipeline configuration (variables)
 */
async function preparePipelineConfig(
  context: PipelineContext,
  executionId: string,
  apiClient: BackendClient,
  sql: Sql
): Promise<{ variables: Record<string, string> }> {
  logger.info(`✓ Using CI runner: ${context.session.runner}`)

  const apiBaseUrl = process.env.GITLAB_RUNNER_API_URL || process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000'

  // Get project-specific API key for pipeline authentication
  logger.info(`🔑 Retrieving pipeline API key for project ${context.project.id}`)
  const apiToken = await getCachedPipelineApiKey(sql, context.project.id)
  logger.info(`✓ Pipeline API key obtained`)

  const aiEnvVars = await getAIProviderEnvVars({
    projectId: context.project.id,
    userId: context.userId,
    aiProviderConfigs: context.project.ai_provider_configs,
    apiClient,
    sql
  })

  validateRequiredApiKeys(context.session.runner, aiEnvVars)
  logger.info(`✓ Required API keys validated for runner type: ${context.session.runner}`)

  let repoVars: Record<string, string> = {}
  try {
    repoVars = await loadFileSpaces(apiClient, context.task.id, context.session.runner!)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot run')) {
      throw error
    }
    logger.error(`❌ Failed to load file space configuration: ${error}`)
    if (error instanceof Error) {
      logger.error(`   Error stack: ${error.stack}`)
    }
  }

  const variables: Record<string, string> = {
    SESSION_ID: context.session.id,
    PIPELINE_EXECUTION_ID: executionId,
    PROJECT_ID: context.project.id,
    RUNNER_TYPE: context.session.runner!,
    API_BASE_URL: apiBaseUrl,
    API_TOKEN: apiToken,
    ...aiEnvVars,
    ...repoVars,
    ...getProxyVars(),
    ...getMockModeVars()
  }

  logPipelineVariables(variables)
  return { variables }
}

/**
 * Execute pipeline trigger with retry logic and update execution record
 */
async function executePipelineTrigger(
  context: PipelineContext,
  executionId: string,
  config: { variables: Record<string, string> },
  executorConfig: { host: string; accessToken: string; projectPath: string },
  apiClient: BackendClient
): Promise<{ execution: PipelineExecution; pipelineUrl: string }> {
  const gitlabClient = new GitLabApiClient(executorConfig.host, executorConfig.accessToken)

  // Trigger pipeline with retry
  const pipeline = await retry(
    async () => {
      logger.info(`📡 Attempting to trigger pipeline...`)
      return await gitlabClient.triggerPipeline(context.source.project_id!, {
        ref: 'main',
        variables: config.variables,
      })
    },
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      onRetry: (error, attempt) => {
        if (isRetryableError(error)) {
          logger.warn(`⚠️  Pipeline trigger failed (attempt ${attempt}/3): ${error.message}. Retrying...`)
        } else {
          logger.error(`❌ Non-retryable error: ${error.message}. Aborting.`)
          throw error
        }
      },
    }
  )

  logger.info(`✓ GitLab pipeline triggered: ${pipeline.id}`)

  // Update execution record
  const execution = await apiClient.run(updatePipelineExecutionConfig, {
    params: { id: executionId },
    body: {
      pipeline_id: pipeline.id.toString(),
      status: 'pending' as const,
      last_status_update: new Date().toISOString(),
    }
  }) as unknown as PipelineExecution

  const pipelineUrl = `${executorConfig.host}/${executorConfig.projectPath}/-/pipelines/${pipeline.id}`

  return {
    execution,
    pipelineUrl,
  }
}

/**
 * Trigger a GitLab pipeline for a session
 */
export async function triggerPipeline(
  input: TriggerPipelineInput,
  sql?: Sql
): Promise<TriggerPipelineResult> {
  logger.info(`🚀 Triggering pipeline for session ${input.sessionId}`)

  // sql parameter is optional for backward compatibility
  // If not provided, we'll use the default connection
  const sqlInstance = sql || defaultSql

  let executionId: string | undefined

  try {
    // Validate and fetch all required context
    const context = await validateAndFetchPipelineContext(input.apiClient, input.sessionId, sqlInstance)

    // 🔍 DEBUG: Log session details
    logger.info(`🔍 DEBUG - Session details:`)
    logger.info(`  Session ID: ${context.session.id}`)
    logger.info(`  Session runner: ${context.session.runner}`)
    logger.info(`  Task ID: ${context.session.task_id}`)
    logger.info(`  Task title: ${context.task.id}`)
    logger.info(`  Will set RUNNER_TYPE to: ${context.session.runner}`)

    // Check if workspace needs sync before running evaluation/implementation
    const syncCheck = await checkWorkspaceSyncStatus(context.project.id, input.apiClient)
    if (syncCheck.needsSync) {
      logger.info(`⚠️  Workspace sync required: ${syncCheck.reason}`)
      // Wait for sync to complete instead of failing
      await waitForWorkspaceSync(context.project.id, input.apiClient)
    }
    logger.info(`✓ Workspace is up-to-date, proceeding with pipeline execution`)

    // Create pipeline execution record
    const execution = await input.apiClient.run(createPipelineExecutionConfig, {
      body: {
        session_id: context.session.id,
        worker_repository_id: context.workerRepo.id,
        status: 'pending' as const,
      }
    })
    executionId = execution.id
    logger.info(`✓ Created pipeline execution record: ${execution.id}`)

    // Prepare pipeline configuration
    const config = await preparePipelineConfig(context, execution.id, input.apiClient, sqlInstance)
    logger.info(`✓ Pipeline variables prepared`)

    // Get executor configuration (project-level or worker repository)
    const executorConfig = await getExecutorConfig(context, input.apiClient)

    // Trigger pipeline and update execution
    const result = await executePipelineTrigger(context, execution.id, config, executorConfig, input.apiClient)

    logger.info(`✅ Pipeline triggered successfully: ${result.pipelineUrl}`)

    // Increment implementation quota if using platform token (runner="claude" means implementation)
    if (context.session.runner === 'claude' && context.userId && config.variables.ANTHROPIC_API_KEY) {
      try {
        const platformConfig = getPlatformAnthropicConfig()

        // Only increment if using platform key (not project key)
        if (platformConfig && config.variables.ANTHROPIC_API_KEY === platformConfig.api_key) {
          await incrementQuotaUsage(sqlInstance, context.userId, 'implementation')
          logger.info(`✓ Implementation quota incremented for user ${context.userId}`)
        }
      } catch (quotaError) {
        logger.warn(`⚠️  Failed to increment implementation quota: ${quotaError}`)
        // Don't fail the pipeline trigger if quota increment fails
      }
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Pipeline execution failed for session ${input.sessionId}: ${errorMessage}`)

    if (executionId) {
      await input.apiClient.run(updatePipelineExecutionConfig, {
        params: { id: executionId },
        body: {
          status: 'failed' as const,
          last_status_update: new Date().toISOString(),
        }
      })
    }

    throw error
  }
}
