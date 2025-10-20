import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Sql } from 'postgres'
import { z } from 'zod'
import * as userAccessQueries from '../../db/user-access'
import { authMiddleware } from '../middleware/auth'

const grantAccessSchema = z.object({
  user_id: z.string(),
  entity_type: z.enum(['project', 'task_source', 'file_space', 'secret', 'task']),
  entity_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'developer', 'viewer', 'read', 'write', 'use']),
  granted_by: z.string().optional(),
  expires_at: z.string().datetime().optional(),
})

const revokeAccessSchema = z.object({
  user_id: z.string(),
  entity_type: z.enum(['project', 'task_source', 'file_space', 'secret', 'task']),
  entity_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'developer', 'viewer', 'read', 'write', 'use']).optional(),
})

const entityParamsSchema = z.object({
  entityType: z.enum(['project', 'task_source', 'file_space', 'secret', 'task']),
  entityId: z.string().uuid(),
})

const userIdParamSchema = z.object({
  userId: z.string(),
})

export const createUserAccessRoutes = (sql: Sql) => {
  return new Hono()
    // Grant access to a resource
    .post(
      '/',
      authMiddleware,
      zValidator('json', grantAccessSchema),
      async (c) => {
        const body = c.req.valid('json')

        // TODO: Check if granting user has admin access to the entity
        // const grantingUserId = c.get('userId') as string
        // For now, use the user_id from the request body as granted_by

        const access = await userAccessQueries.grantAccess(sql, {
          ...body,
          granted_by: body.user_id,
          expires_at: body.expires_at ? new Date(body.expires_at) : undefined,
        })

        return c.json(access, 201)
      }
    )

    // Revoke access from a resource
    .delete(
      '/',
      authMiddleware,
      zValidator('json', revokeAccessSchema),
      async (c) => {
        const body = c.req.valid('json')

        // TODO: Check if revoking user has admin access to the entity

        const result = await userAccessQueries.revokeAccess(
          sql,
          body.user_id,
          body.entity_type,
          body.entity_id,
          body.role
        )

        if (!result.ok) {
          return c.json({ error: result.error }, 404)
        }

        return c.body(null, 204)
      }
    )

    // Get all access grants for a specific resource
    .get(
      '/:entityType/:entityId',
      authMiddleware,
      zValidator('param', entityParamsSchema),
      async (c) => {
        const { entityType, entityId } = c.req.valid('param')

        // TODO: Check if user has viewer access to the entity

        const access = await userAccessQueries.findAllUserAccessForEntity(sql, entityType, entityId)
        return c.json(access)
      }
    )

    // Get all access grants for a specific user
    .get(
      '/user/:userId',
      authMiddleware,
      zValidator('param', userIdParamSchema),
      async (c) => {
        const { userId } = c.req.valid('param')

        // TODO: Only allow users to see their own access or admins

        const access = await userAccessQueries.findAllUserAccessForUser(sql, userId)
        return c.json(access)
      }
    )

    // Get projects accessible to current user
    .get('/user/:userId/projects', authMiddleware, zValidator('param', userIdParamSchema), async (c) => {
      const { userId } = c.req.valid('param')

      // TODO: Only allow users to see their own projects

      const projectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
      return c.json({ project_ids: projectIds })
    })

    // Cleanup expired access grants (admin endpoint)
    .post('/cleanup-expired', authMiddleware, async (c) => {
      // TODO: Add global admin check
      const count = await userAccessQueries.cleanupExpiredAccess(sql)
      return c.json({ cleaned_up: count })
    })
}
