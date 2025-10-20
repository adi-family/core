import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/projects'
import * as userAccessQueries from '../../db/user-access'
import { idParamSchema, createProjectSchema, updateProjectSchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'
import { getClerkUserId } from '../middleware/clerk'

export const createProjectRoutes = (sql: Sql) => {
  return new Hono()
    .get('/', async (c) => {
      const userId = getClerkUserId(c)

      // If user is authenticated, filter projects by access
      if (userId) {
        const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
        const allProjects = await queries.findAllProjects(sql)
        const filtered = allProjects.filter(p => accessibleProjectIds.includes(p.id))
        return c.json(filtered)
      }

      // If no user authentication, return empty array (or all projects for backward compatibility)
      // For now, return all projects to maintain backward compatibility
      const projects = await queries.findAllProjects(sql)
      return c.json(projects)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')
      const userId = getClerkUserId(c)

      // Check if user has access to this project
      if (userId) {
        const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, id, 'viewer')
        if (!hasAccess) {
          return c.json({ error: 'Insufficient permissions' }, 403)
        }
      }

      const result = await queries.findProjectById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createProjectSchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const userId = getClerkUserId(c)

      const project = await queries.createProject(sql, body)

      // Grant owner access to creator
      if (userId) {
        await userAccessQueries.grantAccess(sql, {
          user_id: userId,
          entity_type: 'project',
          entity_id: project.id,
          role: 'owner',
          granted_by: userId,
        })
      }

      return c.json(project, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateProjectSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      const userId = getClerkUserId(c)

      // Require developer access to update
      if (userId) {
        const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, id, 'developer')
        if (!hasAccess) {
          return c.json({ error: 'Insufficient permissions' }, 403)
        }
      }

      const result = await queries.updateProject(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const userId = getClerkUserId(c)

      // Require owner access to delete
      if (userId) {
        const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, id, 'owner')
        if (!hasAccess) {
          return c.json({ error: 'Insufficient permissions' }, 403)
        }
      }

      const result = await queries.deleteProject(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
