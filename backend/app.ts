import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { sql } from '../db/client'
import { createProjectRoutes } from './handlers/projects'
import { createTaskRoutes } from './handlers/tasks'
import { createSessionRoutes } from './handlers/sessions'
import { createMessageRoutes } from './handlers/messages'
import { createWorkerCacheRoutes } from './handlers/worker-cache'
import { createFileSpaceRoutes } from './handlers/file-spaces'
import { createTaskSourceRoutes } from './handlers/task-sources'
import { createWorkerRepositoryRoutes } from './handlers/worker-repositories'
import { createPipelineExecutionRoutes } from './handlers/pipeline-executions'
import { createPipelineArtifactRoutes } from './handlers/pipeline-artifacts'
import { createWebhookRoutes } from './handlers/webhooks'
import { authMiddleware } from './middleware/auth'
import * as sessionQueries from '../db/sessions'
import * as messageQueries from '../db/messages'
import * as pipelineExecutionQueries from '../db/pipeline-executions'
import * as pipelineArtifactQueries from '../db/pipeline-artifacts'
import * as workerRepoQueries from '../db/worker-repositories'
import * as projectQueries from '../db/projects'
import { initTrafficLight } from '../db/worker-cache'
import { CIRepositoryManager } from '../worker/ci-repository-manager'
import { createLogger } from '../utils/logger'
import {
  idParamSchema,
  taskIdParamSchema,
  sessionIdParamSchema,
  executionIdParamSchema,
  projectIdParamSchema,
  issueIdParamSchema,
  setupWorkerRepositorySchema,
  lockContextSchema,
  signalInfoSchema,
  isSignaledBodySchema,
  releaseLockBodySchema,
  createPipelineArtifactSchema,
  updatePipelineExecutionSchema
} from './schemas'

const app = new Hono()
  // Mount main routes
  .route('/projects', createProjectRoutes(sql))
  .route('/tasks', createTaskRoutes(sql))
  .route('/sessions', createSessionRoutes(sql))
  .route('/messages', createMessageRoutes(sql))
  .route('/worker-cache', createWorkerCacheRoutes(sql))
  .route('/file-spaces', createFileSpaceRoutes(sql))
  .route('/task-sources', createTaskSourceRoutes(sql))
  .route('/worker-repositories', createWorkerRepositoryRoutes(sql))
  .route('/pipeline-executions', createPipelineExecutionRoutes(sql))
  .route('/pipeline-artifacts', createPipelineArtifactRoutes(sql))
  .route('/webhooks', createWebhookRoutes(sql))
  // Nested routes that need special handling
  // Tasks -> Sessions
  .get('/tasks/:taskId/sessions', zValidator('param', taskIdParamSchema), async (c) => {
    const { taskId } = c.req.valid('param')
    const sessions = await sessionQueries.findSessionsByTaskId(sql, taskId)
    return c.json(sessions)
  })
  // Sessions -> Messages
  .get('/sessions/:sessionId/messages', zValidator('param', sessionIdParamSchema), async (c) => {
    const { sessionId } = c.req.valid('param')
    const messages = await messageQueries.findMessagesBySessionId(sql, sessionId)
    return c.json(messages)
  })
  // Sessions -> Pipeline Executions
  .get('/sessions/:sessionId/pipeline-executions', zValidator('param', sessionIdParamSchema), async (c) => {
    const { sessionId } = c.req.valid('param')
    const executions = await pipelineExecutionQueries.findPipelineExecutionsBySessionId(sql, sessionId)
    return c.json(executions)
  })
  // Pipeline Executions -> Artifacts
  .get('/pipeline-executions/:executionId/artifacts', zValidator('param', executionIdParamSchema), async (c) => {
    const { executionId } = c.req.valid('param')
    const artifacts = await pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, executionId)
    return c.json(artifacts)
  })
  .post('/pipeline-executions/:executionId/artifacts', zValidator('param', executionIdParamSchema), zValidator('json', createPipelineArtifactSchema), authMiddleware, async (c) => {
    const { executionId } = c.req.valid('param')
    const body = c.req.valid('json')
    const artifactData = {
      ...body,
      pipeline_execution_id: executionId
    }
    const artifact = await pipelineArtifactQueries.createPipelineArtifact(sql, artifactData)
    return c.json(artifact, 201)
  })
  // Projects -> Worker Repository
  .get('/projects/:projectId/worker-repository', zValidator('param', projectIdParamSchema), async (c) => {
    const { projectId } = c.req.valid('param')
    const result = await workerRepoQueries.findWorkerRepositoryByProjectId(sql, projectId)
    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }
    return c.json(result.data)
  })
  .post('/projects/:projectId/worker-repository/setup', zValidator('param', projectIdParamSchema), zValidator('json', setupWorkerRepositorySchema), async (c) => {
    const { projectId } = c.req.valid('param')
    const body = c.req.valid('json')

    // Validate environment
    const requiredEnv = ['GITLAB_HOST', 'GITLAB_TOKEN', 'GITLAB_USER', 'ENCRYPTION_KEY']
    const missing = requiredEnv.filter((key) => !process.env[key])

    if (missing.length > 0) {
      return c.json(
        { error: `Missing required environment variables: ${missing.join(', ')}` },
        500
      )
    }

    const logger = createLogger({ namespace: 'worker-repositories-handler' })

    try {
      // Check if worker repository already exists
      const existingRepo = await workerRepoQueries.findWorkerRepositoryByProjectId(sql, projectId)

      if (existingRepo.ok) {
        return c.json(
          {
            error: 'Worker repository already exists for this project',
            repository: existingRepo.data,
          },
          409
        )
      }

      // Fetch project
      const projectResult = await projectQueries.findProjectById(sql, projectId)

      if (!projectResult.ok) {
        return c.json({ error: 'Project not found' }, 404)
      }

      const project = projectResult.data
      logger.info(`Setting up worker repository for project: ${project.name}`)

      // Create worker repository in GitLab
      const manager = new CIRepositoryManager()
      const version = body.version || '2025-10-18-01'
      const customPath = body.customPath || `adi-worker-${project.name.toLowerCase()}`

      const source = await manager.createWorkerRepository({
        projectName: project.name,
        sourceType: 'gitlab',
        host: process.env.GITLAB_HOST!,
        accessToken: process.env.GITLAB_TOKEN!,
        user: process.env.GITLAB_USER!,
        customPath,
      })

      logger.info(`Created GitLab repository: ${source.project_path}`)

      // Upload CI files
      await manager.uploadCIFiles({
        source,
        version,
      })

      logger.info(`Uploaded CI files (version: ${version})`)

      // Save to database
      const workerRepo = await workerRepoQueries.createWorkerRepository(sql, {
        project_id: projectId,
        source_gitlab: source as unknown,
        current_version: version,
      })

      logger.info(`Worker repository saved (ID: ${workerRepo.id})`)

      return c.json(
        {
          repository: workerRepo,
          gitlab_url: `${source.host}/${source.project_path}`,
          next_steps: {
            configure_ci_variables: `${source.host}/${source.project_path}/-/settings/ci_cd`,
            required_variables: ['API_BASE_URL', 'API_TOKEN', 'ANTHROPIC_API_KEY'],
          },
        },
        201
      )
    } catch (error) {
      logger.error('Failed to setup worker repository:', error)
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to setup worker repository',
        },
        500
      )
    }
  })
  // Projects -> Worker Cache (traffic light API)
  .post('/projects/:projectId/worker-cache/is-signaled', zValidator('param', projectIdParamSchema), zValidator('json', isSignaledBodySchema), async (c) => {
    const { projectId } = c.req.valid('param')
    const { issueId, date } = c.req.valid('json')
    const trafficLight = initTrafficLight(sql, projectId)
    const result = await trafficLight.isSignaledBefore(issueId, new Date(date))
    return c.json({ signaled: result })
  })
  .post('/projects/:projectId/worker-cache/try-acquire-lock', zValidator('param', projectIdParamSchema), zValidator('json', lockContextSchema), async (c) => {
    const { projectId } = c.req.valid('param')
    const lockContext = c.req.valid('json')
    const trafficLight = initTrafficLight(sql, projectId)
    const acquired = await trafficLight.tryAcquireLock(lockContext)
    return c.json({ acquired })
  })
  .post('/projects/:projectId/worker-cache/release-lock', zValidator('param', projectIdParamSchema), zValidator('json', releaseLockBodySchema), async (c) => {
    const { projectId } = c.req.valid('param')
    const { issueId } = c.req.valid('json')
    const trafficLight = initTrafficLight(sql, projectId)
    await trafficLight.releaseLock(issueId)
    return c.json({ success: true })
  })
  .post('/projects/:projectId/worker-cache/signal', zValidator('param', projectIdParamSchema), zValidator('json', signalInfoSchema), async (c) => {
    const { projectId } = c.req.valid('param')
    const signalInfo = c.req.valid('json')
    const trafficLight = initTrafficLight(sql, projectId)
    await trafficLight.signal({
      ...signalInfo,
      date: new Date(signalInfo.date)
    })
    return c.json({ success: true })
  })
  .get('/projects/:projectId/worker-cache/:issueId/task-id', zValidator('param', projectIdParamSchema.merge(issueIdParamSchema)), async (c) => {
    const { projectId, issueId } = c.req.valid('param')
    const trafficLight = initTrafficLight(sql, projectId)
    const taskId = await trafficLight.getTaskId(issueId)
    return c.json({ taskId })
  })
  // Apply auth middleware to specific routes
  .patch('/pipeline-executions/:id', zValidator('param', idParamSchema), zValidator('json', updatePipelineExecutionSchema), authMiddleware, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const result = await pipelineExecutionQueries.updatePipelineExecution(sql, id, body)
    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }
    return c.json(result.data)
  })

export { app }
export type AppType = typeof app
