/**
 * Pipeline Executor
 * Triggers GitLab CI pipelines for worker execution
 */

import type { PipelineExecution, GitlabExecutorConfig } from '@types'
import type { BackendClient } from '../api-client'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { retry, isRetryableError } from '@utils/retry'
import { createLogger } from '@utils/logger'
import { CIRepositoryManager } from '../../worker/ci-repository-manager'
import { validateGitLabSource, decryptGitLabToken, type GitLabSource } from './gitlab-utils'

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
  project: { id: string; name: string; job_executor_gitlab: GitlabExecutorConfig | null }
  workerRepo: { id: string; current_version: string | null; source_gitlab: unknown }
  source: GitLabSource
}

/**
 * Auto-create worker repository if it doesn't exist
 */
async function ensureWorkerRepository(
  project: { id: string; name: string; job_executor_gitlab: GitlabExecutorConfig | null },
  apiClient: BackendClient
): Promise<{ id: string; current_version: string | null; source_gitlab: unknown }> {
  // Try to fetch existing worker repository
  const workerRepoRes = await apiClient.projects[':projectId']['worker-repository'].$get({
    param: { projectId: project.id }
  })

  if (workerRepoRes.ok) {
    // Worker repository exists, return it
    return await workerRepoRes.json()
  }

  // Worker repository doesn't exist, auto-create it
  logger.info(`Worker repository not found for project ${project.name}, auto-creating...`)

  // Determine credentials to use
  let gitlabHost: string
  let gitlabToken: string
  let gitlabUser: string

  if (project.job_executor_gitlab) {
    // Use user-configured executor credentials
    const executor = project.job_executor_gitlab
    gitlabHost = executor.host

    // Fetch secret for access token
    const secretRes = await apiClient.secrets[':id'].$get({
      param: { id: executor.access_token_secret_id }
    })

    if (!secretRes.ok) {
      throw new Error(`Failed to fetch GitLab executor secret for project ${project.id}`)
    }

    const secret = await secretRes.json()
    gitlabToken = secret.value

    // Extract user from token (call GitLab API)
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

  // Create worker repository
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
 * Validate and fetch all required context for pipeline execution
 */
async function validateAndFetchPipelineContext(apiClient: BackendClient, sessionId: string): Promise<PipelineContext> {
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

  return { session, task, project, workerRepo, source }
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

    // Fetch secret for access token
    const secretRes = await apiClient.secrets[':id'].$get({
      param: { id: executor.access_token_secret_id }
    })

    if (!secretRes.ok) {
      throw new Error(
        `Failed to fetch GitLab executor secret for project ${context.project.id}. Secret ID: ${executor.access_token_secret_id}`
      )
    }

    const secret = await secretRes.json()

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
 * Prepare pipeline configuration (CI path, variables)
 */
function preparePipelineConfig(context: PipelineContext, executionId: string): {
  ciConfigPath: string
  variables: Record<string, string>
} {
  const ciConfigPath = `${context.workerRepo.current_version}/.gitlab-ci-${context.session.runner}.yml`
  logger.info(`✓ Using CI config: ${ciConfigPath}`)

  // Get API base URL from environment - prefer GITLAB_RUNNER_API_URL for public-facing access
  const apiBaseUrl = process.env.GITLAB_RUNNER_API_URL || process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:3000'
  const apiToken = process.env.API_TOKEN || process.env.BACKEND_API_TOKEN || ''
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || ''

  const variables = {
    SESSION_ID: context.session.id,
    PIPELINE_EXECUTION_ID: executionId,
    CI_CONFIG_PATH: ciConfigPath,
    API_BASE_URL: apiBaseUrl,
    API_TOKEN: apiToken,
    ANTHROPIC_API_KEY: anthropicApiKey,
  }

  return { ciConfigPath, variables }
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
  input: TriggerPipelineInput
): Promise<TriggerPipelineResult> {
  logger.info(`🚀 Triggering pipeline for session ${input.sessionId}`)

  let executionId: string | undefined

  try {
    // Validate and fetch all required context
    const context = await validateAndFetchPipelineContext(input.apiClient, input.sessionId)

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
    const config = preparePipelineConfig(context, execution.id)
    logger.info(`✓ Pipeline variables prepared`)

    // Get executor configuration (project-level or worker repository)
    const executorConfig = await getExecutorConfig(context, input.apiClient)

    // Trigger pipeline and update execution
    const result = await executePipelineTrigger(context, execution.id, config, executorConfig, input.apiClient)

    logger.info(`✅ Pipeline triggered successfully: ${result.pipelineUrl}`)

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
