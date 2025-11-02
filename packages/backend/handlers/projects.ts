/**
 * Project handlers using new @utils/http system
 * Uses factory pattern to inject dependencies
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  listProjectsConfig,
  getProjectConfig,
  createProjectConfig,
  updateProjectConfig,
  deleteProjectConfig,
  getProjectStatsConfig
} from '@adi/api-contracts/projects'
import * as queries from '../../db/projects'
import * as userAccessQueries from '../../db/user-access'
import * as workerRepoQueries from '../../db/worker-repositories'
import { createLogger } from '@utils/logger'
import { GITLAB_HOST, GITLAB_TOKEN, GITLAB_USER, ENCRYPTION_KEY } from '../config'
import { CIRepositoryManager } from '@worker/ci-repository-manager'

const logger = createLogger({ namespace: 'projects-handler' })

/**
 * Create project handlers with dependencies injected
 */
export function createProjectHandlers(sql: Sql) {
  // Helper to get user ID from request
  // TODO: Integrate with actual auth system
  async function getUserId(ctx: any): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized')
    }
    return 'user-id-placeholder'
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

    // TODO: Add ACL check
    const project = await queries.findProjectById(sql, id)

    return project
  })

  /**
   * Get project stats
   */
  const getProjectStats = handler(getProjectStatsConfig, async (ctx) => {
    const { id } = ctx.params

    // TODO: Add ACL check
    const stats = await queries.getProjectStats(sql, id)

    return stats
  })

  /**
   * Create new project
   */
  const createProject = handler(createProjectConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { name, enabled } = ctx.body

    const project = await queries.createProject(sql, { name, enabled })

    await userAccessQueries.grantAccess(sql, {
      user_id: userId,
      entity_type: 'project',
      entity_id: project.id,
      role: 'owner',
      granted_by: userId,
    })

    // Auto-create worker repository
    if (GITLAB_HOST && GITLAB_TOKEN && GITLAB_USER && ENCRYPTION_KEY) {
      try {
        logger.info(`🔧 Auto-creating worker repository for project: ${project.name}`)

        try {
          await workerRepoQueries.findWorkerRepositoryByProjectId(sql, project.id)
          logger.info(`Worker repository already exists for project ${project.id}`)
        } catch (error) {
          if (error instanceof Error && error.constructor.name === 'NotFoundException') {
            const manager = new CIRepositoryManager()
            const version = '2025-10-18-01'
            const projectIdShort = project.id.split('-')[0]
            const customPath = `adi-worker-${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${projectIdShort}`

            const source = await manager.createWorkerRepository({
              projectName: project.name,
              sourceType: 'gitlab',
              host: GITLAB_HOST,
              accessToken: GITLAB_TOKEN,
              user: GITLAB_USER,
              customPath,
            })

            logger.info(`✓ Created GitLab repository: ${source.project_path}`)

            await manager.uploadCIFiles({ source, version })
            logger.info(`✓ Uploaded CI files (version: ${version})`)

            await workerRepoQueries.createWorkerRepository(sql, {
              project_id: project.id,
              source_gitlab: source as unknown,
              current_version: version,
            })

            logger.info(`✅ Worker repository auto-created for project ${project.id}`)
          } else {
            throw error
          }
        }
      } catch (error) {
        logger.error(`⚠️  Failed to auto-create worker repository for project ${project.id}:`, error)
      }
    }

    return project
  })

  /**
   * Update project
   */
  const updateProject = handler(updateProjectConfig, async (ctx) => {
    const { id } = ctx.params
    const updates = ctx.body

    // TODO: Add ACL check
    const project = await queries.updateProject(sql, id, updates)

    return project
  })

  /**
   * Delete project
   */
  const deleteProject = handler(deleteProjectConfig, async (ctx) => {
    const { id } = ctx.params

    // TODO: Add ACL check
    await queries.deleteProject(sql, id)

    return { success: true }
  })

  return {
    listProjects,
    getProject,
    getProjectStats,
    createProject,
    updateProject,
    deleteProject
  }
}
