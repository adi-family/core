import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/file-spaces'
import { idParamSchema, createFileSpaceSchema, updateFileSpaceSchema, projectIdQuerySchema } from '../schemas'
import { authMiddleware } from '../middleware/auth'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { getClerkUserId } from '../middleware/clerk'
import * as userAccessQueries from '../../db/user-access'

export const createFileSpaceRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', zValidator('query', projectIdQuerySchema), async (c) => {
      const { project_id } = c.req.valid('query')
      const userId = getClerkUserId(c)

      if (project_id) {
        // Check project access before returning file spaces
        if (userId) {
          const hasAccess = await acl.project(project_id).viewer.gte.check(c)
          if (!hasAccess) {
            return c.json({ error: 'Insufficient permissions' }, 403)
          }
        }

        const fileSpaces = await queries.findFileSpacesByProjectId(sql, project_id)
        return c.json(fileSpaces)
      }

      // Filter all file spaces by project access
      if (userId) {
        const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
        const allFileSpaces = await queries.findAllFileSpaces(sql)
        const filtered = allFileSpaces.filter(fs => accessibleProjectIds.includes(fs.project_id))
        return c.json(filtered)
      }

      const fileSpaces = await queries.findAllFileSpaces(sql)
      return c.json(fileSpaces)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      // Check file space access
      await acl.fileSpace(id).read.orNull(c)

      const result = await queries.findFileSpaceById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createFileSpaceSchema), authMiddleware, async (c) => {
      const body = c.req.valid('json')
      const userId = getClerkUserId(c)

      try {
        // Require developer access to project
        await acl.project(body.project_id).developer.gte.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const fileSpace = await queries.createFileSpace(sql, body)

      // Grant write access to creator
      if (userId) {
        await userAccessQueries.grantAccess(sql, {
          user_id: userId,
          entity_type: 'file_space',
          entity_id: fileSpace.id,
          role: 'write',
          granted_by: userId,
        })
      }

      return c.json(fileSpace, 201)
    })
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateFileSpaceSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')

      try {
        // Require write access
        await acl.fileSpace(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.updateFileSpace(sql, id, body)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), authMiddleware, async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require write access
        await acl.fileSpace(id).write.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.deleteFileSpace(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json({ success: true })
    })
}
