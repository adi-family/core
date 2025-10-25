import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/file-spaces'
import { idParamSchema, createFileSpaceSchema, updateFileSpaceSchema, projectIdQuerySchema } from '../schemas'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { getClerkUserId } from '../middleware/clerk'
import { isServiceAuthenticated } from '../middleware/service-auth'
import * as userAccessQueries from '../../db/user-access'

export const createFileSpaceRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', zValidator('query', projectIdQuerySchema), async (c) => {
      const { project_id } = c.req.valid('query')

      // Service authentication (API_TOKEN) bypasses user checks
      const isService = isServiceAuthenticated(c)
      const userId = getClerkUserId(c)

      if (!userId && !isService) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      if (project_id) {
        // For service calls, skip ACL check. For user calls, check access.
        if (!isService) {
          const hasAccess = await acl.project(project_id).viewer.gte.check(c)
          if (!hasAccess) {
            return c.json({ error: 'Insufficient permissions' }, 403)
          }
        }

        const fileSpaces = await queries.findFileSpacesByProjectId(sql, project_id)
        return c.json(fileSpaces)
      }

      // Service calls return all file spaces, user calls return only accessible ones
      if (isService) {
        const allFileSpaces = await queries.findAllFileSpaces(sql)
        return c.json(allFileSpaces)
      }

      const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId!)
      const allFileSpaces = await queries.findAllFileSpaces(sql)
      const filtered = allFileSpaces.filter(fs => accessibleProjectIds.includes(fs.project_id))
      return c.json(filtered)
    })
    .get('/:id', zValidator('param', idParamSchema), async (c) => {
      const { id } = c.req.valid('param')

      try {
        // Require read access
        await acl.fileSpace(id).read.throw(c)
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return c.json({ error: error.message }, error.statusCode as 401 | 403)
        }
        throw error
      }

      const result = await queries.findFileSpaceById(sql, id)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .post('/', zValidator('json', createFileSpaceSchema), async (c) => {
      const body = c.req.valid('json')

      // Service authentication (API_TOKEN) bypasses user checks
      const isService = isServiceAuthenticated(c)
      const userId = getClerkUserId(c)

      if (!userId && !isService) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      // For service calls, skip ACL check. For user calls, check access.
      if (!isService) {
        try {
          // Require developer access to project
          await acl.project(body.project_id).developer.gte.throw(c)
        } catch (error) {
          if (error instanceof AccessDeniedError) {
            return c.json({ error: error.message }, error.statusCode as 401 | 403)
          }
          throw error
        }
      }

      const fileSpace = await queries.createFileSpace(sql, body)

      // Grant write access to creator (only for user calls)
      if (userId && !isService) {
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
    .patch('/:id', zValidator('param', idParamSchema), zValidator('json', updateFileSpaceSchema), async (c) => {
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

      const result = await queries.updateFileSpace(sql, id, body as import('../../types').UpdateFileSpaceInput)

      if (!result.ok) {
        return c.json({ error: result.error }, 404)
      }

      return c.json(result.data)
    })
    .delete('/:id', zValidator('param', idParamSchema), async (c) => {
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
