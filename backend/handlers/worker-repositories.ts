import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/worker-repositories'
import * as projectQueries from '../../db/projects'
import { CIRepositoryManager } from '../../worker/ci-repository-manager'
import { createLogger } from '../../utils/logger'
import { idParamSchema, projectIdParamSchema, createWorkerRepositorySchema, updateWorkerRepositorySchema, setupWorkerRepositorySchema, updateVersionSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'

const logger = createLogger({ namespace: 'worker-repositories-handler' })

export const createWorkerRepositoryRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const repos = await queries.findAllWorkerRepositories(sql)
      return c.json(repos)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.findWorkerRepositoryById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createWorkerRepositorySchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const repo = await queries.createWorkerRepository(sql, body)
      return c.json(repo, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateWorkerRepositorySchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const result = await queries.updateWorkerRepository(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const result = await queries.deleteWorkerRepository(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
    // Note: This route needs special handling in app.ts since it uses /projects/:projectId prefix
    .get('/by-project/:projectId', zValidator('param', projectIdParamSchema), async (c) => {
      const { projectId } = c.req.valid('param')
      const result = await queries.findWorkerRepositoryByProjectId(sql, projectId)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    // Note: This route needs special handling in app.ts since it uses /projects/:projectId prefix
    .post('/setup/:projectId', zValidator('param', projectIdParamSchema), zValidator('json', setupWorkerRepositorySchema), async (c) => {
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

    try {
      // Check if worker repository already exists
      const existingRepo = await queries.findWorkerRepositoryByProjectId(sql, projectId)

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
      const workerRepo = await queries.createWorkerRepository(sql, {
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
    .post('/:id/update-version', zValidator('param', idParamSchema), zValidator('json', updateVersionSchema), authMiddleware, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')

    try {
      // Fetch worker repository
      const result = await queries.findWorkerRepositoryById(sql, id)

      if (!result.ok) {
        return c.json({ error: 'Worker repository not found' }, 404)
      }

      const workerRepo = result.data
      const source = workerRepo.source_gitlab as unknown as {
        type: string
        project_path?: string
        host?: string
        access_token_encrypted?: string
      }

      logger.info(
        `Updating worker repository ${id} from version ${workerRepo.current_version} to ${body.version}`
      )

      // Upload new version
      const manager = new CIRepositoryManager()
      await manager.updateVersion(source as never, body.version)

      // Update database
      const updateResult = await queries.updateWorkerRepository(sql, id, {
        current_version: body.version,
      })

      if (!updateResult.ok) {
        throw new Error('Failed to update worker repository in database')
      }

      logger.info(`Worker repository ${id} updated to version ${body.version}`)

      return c.json({
        repository: updateResult.data,
        previous_version: workerRepo.current_version,
        new_version: body.version,
        gitlab_url: `${source.host}/${source.project_path}`,
      })
    } catch (error) {
      logger.error('Failed to update worker repository version:', error)
      return c.json(
        {
          error:
            error instanceof Error ? error.message : 'Failed to update worker repository version',
        },
        500
      )
    }
    })
}
