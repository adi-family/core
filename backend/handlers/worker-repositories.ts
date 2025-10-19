import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../../db/worker-repositories'
import * as projectQueries from '../../db/projects'
import { CIRepositoryManager } from '../../worker/ci-repository-manager'
import { createLogger } from '../../utils/logger'

const logger = createLogger({ namespace: 'worker-repositories-handler' })

export const createWorkerRepositoryHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const repos = await queries.findAllWorkerRepositories(sql)
    return c.json(repos)
  },

  get: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.findWorkerRepositoryById(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  getByProjectId: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const result = await queries.findWorkerRepositoryByProjectId(sql, projectId)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  create: async (c: Context) => {
    const body = await c.req.json()
    const repo = await queries.createWorkerRepository(sql, body)
    return c.json(repo, 201)
  },

  update: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json()
    const result = await queries.updateWorkerRepository(sql, id, body)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json(result.data)
  },

  delete: async (c: Context) => {
    const id = c.req.param('id')
    const result = await queries.deleteWorkerRepository(sql, id)

    if (!result.ok) {
      return c.json({ error: result.error }, 404)
    }

    return c.json({ success: true })
  },

  /**
   * Setup a new worker repository for a project
   * POST /projects/:projectId/worker-repository/setup
   * Body: { version?: string, customPath?: string }
   */
  setup: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const body = await c.req.json<{ version?: string; customPath?: string }>()

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
  },

  /**
   * Update worker repository to a new version
   * POST /worker-repositories/:id/update-version
   * Body: { version: string }
   */
  updateVersion: async (c: Context) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ version: string }>()

    if (!body.version) {
      return c.json({ error: 'version is required' }, 400)
    }

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
  },
})
