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
import { getPlatformAnthropicConfig } from '@backend/config'
import { checkProjectHasAnthropicProvider } from '@backend/services/ai-provider-selector'
import { sql as defaultSql } from '@db/client'

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
  apiClient: BackendClient
): Promise<{ id: string; current_version: string | null; source_gitlab: unknown }> {
  const workerRepoRes = await apiClient.projects[':projectId']['worker-repository'].$get({
    param: { projectId: project.id }
  })

  if (workerRepoRes.ok) {
    const workerRepo = await workerRepoRes.json()

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
  }

  logger.info(`Worker repository not found for project ${project.name}, auto-creating...`)

  let gitlabHost: string
  let gitlabToken: string
  let gitlabUser: string

  if (project.job_executor_gitlab) {
    const executor = project.job_executor_gitlab
    gitlabHost = executor.host

    const secretRes = await apiClient.secrets[':id'].value.$get({
      param: { id: executor.access_token_secret_id }
    })

    if (!secretRes.ok) {
      throw new Error(`Failed to fetch GitLab executor secret for project ${project.id}`)
    }

    const secret = await secretRes.json() as any
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

  // Save to database
  const createRes = await apiClient['worker-repositories'].$post({
    json: {
      project_id: project.id,
      source_gitlab: source as unknown,
      current_version: version,
    }
  })

  if (!createRes.ok) {
    throw new Error('Failed to create worker repository record in database')
  }

  const workerRepo = await createRes.json()
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
    const projectRes = await apiClient.projects[':id'].$get({ param: { id: projectId } })
    if (!projectRes.ok) {
      return { needsSync: false } // Let other validation handle missing project
    }
    const project = await projectRes.json()

    // If never synced, workspace needs sync
    if (!project.last_synced_at) {
      return {
        needsSync: true,
        reason: 'Workspace has never been synced. Please add file spaces and wait for sync to complete.'
      }
    }

    // Fetch all file spaces for project
    const fileSpacesRes = await apiClient['file-spaces'].$get({
      query: { project_id: projectId }
    })
    if (!fileSpacesRes.ok) {
      return { needsSync: false } // No file spaces configured
    }

    const fileSpacesData = await fileSpacesRes.json()
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
  // Fetch session
  const sessionRes = await apiClient.sessions[':id'].$get({ param: { id: sessionId } })
  if (!sessionRes.ok) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  const session = await sessionRes.json()

  if (!session.task_id) {
    throw new Error(`Session ${sessionId} has no associated task. Please ensure the session is properly configured.`)
  }

  // Fetch task
  const taskRes = await apiClient.tasks[':id'].$get({ param: { id: session.task_id } })
  if (!taskRes.ok) {
    throw new Error(`Task not found: ${session.task_id}`)
  }
  const task = await taskRes.json()

  if (!task.project_id) {
    throw new Error(`Task ${task.id} has no associated project. Please ensure the task is properly configured.`)
  }

  // Fetch project
  const projectRes = await apiClient.projects[':id'].$get({ param: { id: task.project_id } })
  if (!projectRes.ok) {
    throw new Error(`Project not found: ${task.project_id}`)
  }
  const project = await projectRes.json()

  // Get project owner for AI provider selection
  const userId = await getProjectOwnerId(sql, task.project_id)

  // Fetch or auto-create worker repository
  const workerRepo = await ensureWorkerRepository(project, apiClient)
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
    const secretRes = await apiClient.secrets[':id'].value.$get({
      param: { id: executor.access_token_secret_id }
    })

    if (!secretRes.ok) {
      throw new Error(
        `Failed to fetch GitLab executor secret for project ${context.project.id}. Secret ID: ${executor.access_token_secret_id}`
      )
    }

    const secret = await secretRes.json() as any

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
async function getAIProviderEnvVars(
  projectId: string,
  userId: string | null,
  aiProviderConfigs: AIProviderConfig | null,
  apiClient: BackendClient,
  sql: Sql
): Promise<Record<string, string>> {
  const envVars: Record<string, string> = {}

  if (userId && !aiProviderConfigs?.anthropic) {
    try {
      const quotaCheck = await checkQuotaAvailable(sql, userId, 'implementation')

      // If user at hard limit, require project API key
      if (quotaCheck.at_hard_limit) {
        const hasProjectKey = await checkProjectHasAnthropicProvider(sql, projectId)
        if (!hasProjectKey) {
          throw new Error(
            `Implementation quota exceeded (${quotaCheck.used}/${quotaCheck.hard_limit}). ` +
            `Please configure your own Anthropic API key in project settings to continue.`
          )
        }
        // Fall through to use project key
      } else {
        // User has quota - use platform key
        const platformConfig = getPlatformAnthropicConfig()

        if (platformConfig) {
          envVars.ANTHROPIC_API_KEY = platformConfig.api_key
          logger.info(`✓ Using platform Anthropic API key for implementation (${quotaCheck.used}/${quotaCheck.hard_limit})`)

          if (quotaCheck.at_soft_limit) {
            logger.warn(`⚠️  Implementation quota at soft limit (${quotaCheck.used}/${quotaCheck.hard_limit})`)
          }

          // Platform config is always cloud type, no endpoint_url needed
          if (platformConfig.model) {
            envVars.ANTHROPIC_MODEL = platformConfig.model
          }
          if (platformConfig.max_tokens) {
            envVars.ANTHROPIC_MAX_TOKENS = platformConfig.max_tokens.toString()
          }
          if (platformConfig.temperature !== undefined) {
            envVars.ANTHROPIC_TEMPERATURE = platformConfig.temperature.toString()
          }

          // Return early since we got platform config
          return envVars
        } else {
          logger.warn(`⚠️  No platform API key configured`)
          // Fall through to try project configs
        }
      }
    } catch (error) {
      logger.warn(`⚠️  Could not check implementation quota: ${error}`)
      // Fall through to try project configs
    }
  }

  if (!aiProviderConfigs) {
    return envVars
  }

  try {
    // Process Anthropic configuration
    if (aiProviderConfigs.anthropic) {
      const config = aiProviderConfigs.anthropic
      try {
        const secretRes = await apiClient.secrets[':id'].value.$get({ param: { id: config.api_key_secret_id } })
        if (secretRes.ok) {
          const secret = await secretRes.json() as any
          const apiKey = secret.value

          if (apiKey && apiKey.trim()) {
            envVars.ANTHROPIC_API_KEY = apiKey
            const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
            logger.info(`✓ Loaded ANTHROPIC_API_KEY from secret ${config.api_key_secret_id} (${maskedKey}, length: ${apiKey.length})`)

            // Set additional configuration only if API key is valid
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
          } else {
            logger.warn(`⚠️  Anthropic API key secret ${config.api_key_secret_id} exists but value is empty`)
          }
        } else {
          logger.warn(`⚠️  Failed to fetch Anthropic API key secret ${config.api_key_secret_id}`)
        }
      } catch (error) {
        logger.warn(`⚠️  Failed to load Anthropic config: ${error}`)
      }
    }

    // Process OpenAI configuration
    if (aiProviderConfigs.openai) {
      const config = aiProviderConfigs.openai
      try {
        const secretRes = await apiClient.secrets[':id'].value.$get({ param: { id: config.api_key_secret_id } })
        if (secretRes.ok) {
          const secret = await secretRes.json() as any
          const apiKey = secret.value

          if (apiKey && apiKey.trim()) {
            envVars.OPENAI_API_KEY = apiKey
            logger.info(`✓ Loaded OPENAI_API_KEY from secret ${config.api_key_secret_id}`)

            if (config.type === 'azure') {
              envVars.OPENAI_API_BASE = config.endpoint_url
              envVars.OPENAI_API_TYPE = 'azure'
              envVars.OPENAI_API_VERSION = config.api_version
              envVars.OPENAI_DEPLOYMENT_NAME = config.deployment_name
              logger.info(`✓ Configured Azure OpenAI with deployment ${config.deployment_name}`)
            } else if (config.type === 'self-hosted') {
              envVars.OPENAI_API_BASE = config.endpoint_url
              logger.info(`✓ Set OPENAI_API_BASE to ${config.endpoint_url}`)
            } else if (config.type === 'cloud' && config.organization_id) {
              envVars.OPENAI_ORGANIZATION = config.organization_id
            }

            if (config.model) {
              envVars.OPENAI_MODEL = config.model
            }
          } else {
            logger.warn(`⚠️  OpenAI API key secret ${config.api_key_secret_id} exists but value is empty`)
          }
        } else {
          logger.warn(`⚠️  Failed to fetch OpenAI API key secret ${config.api_key_secret_id}`)
        }
      } catch (error) {
        logger.warn(`⚠️  Failed to load OpenAI config: ${error}`)
      }
    }

    // Process Google configuration
    if (aiProviderConfigs.google) {
      const config = aiProviderConfigs.google
      try {
        const secretRes = await apiClient.secrets[':id'].value.$get({ param: { id: config.api_key_secret_id } })
        if (secretRes.ok) {
          const secret = await secretRes.json() as any
          const apiKey = secret.value

          if (apiKey && apiKey.trim()) {
            envVars.GOOGLE_API_KEY = apiKey
            logger.info(`✓ Loaded GOOGLE_API_KEY from secret ${config.api_key_secret_id}`)

            // Set additional configuration only if API key is valid
            if (config.type === 'vertex') {
              envVars.GOOGLE_PROJECT_ID = config.project_id
              envVars.GOOGLE_LOCATION = config.location
              logger.info(`✓ Configured Vertex AI with project ${config.project_id} in ${config.location}`)
            } else if (config.type === 'self-hosted') {
              envVars.GOOGLE_API_ENDPOINT = config.endpoint_url
              logger.info(`✓ Set GOOGLE_API_ENDPOINT to ${config.endpoint_url}`)
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
          } else {
            logger.warn(`⚠️  Google API key secret ${config.api_key_secret_id} exists but value is empty`)
          }
        } else {
          logger.warn(`⚠️  Failed to fetch Google API key secret ${config.api_key_secret_id}`)
        }
      } catch (error) {
        logger.warn(`⚠️  Failed to load Google config: ${error}`)
      }
    }
  } catch (error) {
    logger.error(`❌ Failed to fetch AI provider configurations for project ${projectId}: ${error}`)
  }

  return envVars
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
 * Prepare pipeline configuration (variables)
 */
async function preparePipelineConfig(
  context: PipelineContext,
  executionId: string,
  apiClient: BackendClient,
  sql: Sql
): Promise<{
  variables: Record<string, string>
}> {
  logger.info(`✓ Using CI runner: ${context.session.runner}`)

  // Get API base URL from environment - prefer GITLAB_RUNNER_API_URL for public-facing access
  const apiBaseUrl = process.env.GITLAB_RUNNER_API_URL || process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000'
  const apiToken = process.env.API_TOKEN || process.env.BACKEND_API_TOKEN || ''

  // Fetch AI provider configurations and prepare environment variables
  const aiEnvVars = await getAIProviderEnvVars(
    context.project.id,
    context.userId,
    context.project.ai_provider_configs,
    apiClient,
    sql
  )

  // Validate that required API keys are present before triggering pipeline
  validateRequiredApiKeys(context.session.runner, aiEnvVars)
  logger.info(`✓ Required API keys validated for runner type: ${context.session.runner}`)

  // Prepare repository access variables for codebase cloning
  const repoVars: Record<string, string> = {}
  try {
    logger.info(`🔍 Loading file spaces for task ${context.task.id}...`)

    // Get file spaces associated with this task via junction table
    const fileSpacesRes = await apiClient.tasks[':id']['file-spaces'].$get({
      param: { id: context.task.id }
    })

    if (!fileSpacesRes.ok) {
      logger.warn(`⚠️  Failed to fetch file spaces: HTTP ${fileSpacesRes.status}`)
    } else {
      const fileSpaces = await fileSpacesRes.json()
      logger.info(`📦 API returned ${fileSpaces.length} file space(s) for task`)

      if (fileSpaces.length === 0) {
        logger.error(`❌ Task has no file spaces configured`)
        logger.error(`   ${context.session.runner} pipelines require at least one file space with code to analyze`)
        logger.error(`   Please configure file spaces for this task before running evaluation or implementation`)
        throw new Error(
          `Cannot run ${context.session.runner} pipeline: Task has no file spaces configured. ` +
          `Please add at least one file space with a repository URL to this task.`
        )
      }

      if (fileSpaces.length > 0) {
        logger.info(`📦 Processing ${fileSpaces.length} file space(s)...`)

        // Prepare array of file space configurations for cloning
        const fileSpaceConfigs = []

        for (const fileSpace of fileSpaces) {
          if (!fileSpace) {
            logger.warn('⚠️  File space is undefined, skipping')
            continue
          }

          const config = fileSpace.config as any
          if (!config.repo) {
            logger.warn(`⚠️  File space ${fileSpace.name} has no repo URL, skipping`)
            continue
          }

          const spaceConfig: any = {
            name: fileSpace.name,
            id: fileSpace.id,
            repo: config.repo,
            host: config.host
          }

          // Fetch access token from secret if configured
          if (config.access_token_secret_id) {
            try {
              const secretRes = await apiClient.secrets[':id'].value.$get({
                param: { id: config.access_token_secret_id }
              })

              if (secretRes.ok) {
                const secret = await secretRes.json() as any
                spaceConfig.token = secret.value
                logger.info(`✓ Access token loaded for ${fileSpace.name}`)
              }
            } catch (error) {
              logger.warn(`⚠️  Failed to load token for ${fileSpace.name}: ${error}`)
            }
          }

          fileSpaceConfigs.push(spaceConfig)
          logger.info(`✓ Configured file space: ${fileSpace.name} (${config.repo})`)
        }

        // Pass all file spaces as JSON
        if (fileSpaceConfigs.length > 0) {
          repoVars.FILE_SPACES = JSON.stringify(fileSpaceConfigs)
          logger.info(`✓ ${fileSpaceConfigs.length} file space(s) will be cloned`)
          logger.info(`   FILE_SPACES variable will be passed to pipeline`)
        } else {
          logger.error(`❌ No valid file spaces after filtering`)
          logger.error(`   All file spaces are missing repository URLs`)
          logger.error(`   Each file space must have a 'repo' field in its config with a valid git repository URL`)
          throw new Error(
            `Cannot run ${context.session.runner} pipeline: All file spaces are missing repository URLs. ` +
            `Please ensure each file space has a 'repo' field configured with a valid git repository URL.`
          )
        }
      }
    }
  } catch (error) {
    // If it's one of our validation errors, re-throw it
    if (error instanceof Error && error.message.includes('Cannot run')) {
      throw error
    }

    // Otherwise log and continue (file spaces are optional for some pipelines)
    logger.error(`❌ Failed to load file space configuration: ${error}`)
    if (error instanceof Error) {
      logger.error(`   Error stack: ${error.stack}`)
    }
  }

  // Add proxy configuration from environment variables (optional)
  const proxyVars: Record<string, string> = {}
  if (process.env.PROXY_HOST && process.env.PROXY_USER && process.env.PROXY_PASS) {
    proxyVars.PROXY_HOST = process.env.PROXY_HOST
    proxyVars.PROXY_USER = process.env.PROXY_USER
    proxyVars.PROXY_PASS = process.env.PROXY_PASS
    logger.info(`✓ Proxy configuration will be passed to pipeline: ${process.env.PROXY_HOST}`)
  }

  // Add MOCK_MODE configuration from environment (optional)
  const mockModeVars: Record<string, string> = {}
  if (process.env.MOCK_MODE === 'true') {
    mockModeVars.MOCK_MODE = 'true'
    logger.info(`🎭 MOCK_MODE enabled - AI API calls will be mocked`)
  }

  const variables: Record<string, string> = {
    SESSION_ID: context.session.id,
    PIPELINE_EXECUTION_ID: executionId,
    PROJECT_ID: context.project.id,
    RUNNER_TYPE: context.session.runner!, // Already validated in validateAndFetchPipelineContext
    API_BASE_URL: apiBaseUrl,
    API_TOKEN: apiToken,
    ...aiEnvVars,
    ...repoVars,
    ...proxyVars,
    ...mockModeVars
  }

  // 🔍 DEBUG: Log pipeline variables being sent
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
  const updateRes = await apiClient['pipeline-executions'][':id'].$patch({
    param: { id: executionId },
    json: {
      pipeline_id: pipeline.id.toString(),
      status: 'pending' as const,
      last_status_update: new Date().toISOString(),
    }
  })

  if (!updateRes.ok) {
    throw new Error(`Failed to update pipeline execution ${executionId} with pipeline ID ${pipeline.id}`)
  }

  const execution = await updateRes.json() as unknown as PipelineExecution
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
    const createRes = await input.apiClient['pipeline-executions'].$post({
      json: {
        session_id: context.session.id,
        worker_repository_id: context.workerRepo.id,
        status: 'pending' as const,
      }
    })
    if (!createRes.ok) {
      throw new Error('Failed to create pipeline execution record')
    }
    const execution = await createRes.json()
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
      await input.apiClient['pipeline-executions'][':id'].$patch({
        param: { id: executionId },
        json: {
          status: 'failed' as const,
          last_status_update: new Date().toISOString(),
        }
      })
    }

    throw error
  }
}
