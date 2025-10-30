import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import type { Sql } from 'postgres'
import { z } from 'zod'
import * as userAccessQueries from '../../db/user-access'
import { hasAdminAccess } from '../../db/user-access'
import { reqAdminAuthed, reqAuthed } from '@backend/middleware/authz'

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
      zValidator('json', grantAccessSchema),
      (async (c) => {
        const grantingUserId = await reqAuthed(c);
        const body = c.req.valid('json')

        // Check if granting user has admin access to the entity
        const hasAccess = await userAccessQueries.hasAccessToResource(
          sql,
          grantingUserId,
          body.entity_type,
          body.entity_id,
          'admin'
        )

        if (!hasAccess) {
          return c.json({ error: 'Admin access required to grant permissions' }, 403)
        }

        const access = await userAccessQueries.grantAccess(sql, {
          ...body,
          granted_by: grantingUserId,
          expires_at: body.expires_at,
        })

        return c.json(access, 201)
      })
    )

    // Revoke access from a resource
    .delete(
      '/',
      zValidator('json', revokeAccessSchema),
      (async (c) => {
        const revokingUserId = await reqAuthed(c);
        const body = c.req.valid('json')

        // Check if revoking user has admin access to the entity
        const hasAccess = await userAccessQueries.hasAccessToResource(
          sql,
          revokingUserId,
          body.entity_type,
          body.entity_id,
          'admin'
        )

        if (!hasAccess) {
          return c.json({ error: 'Admin access required to revoke permissions' }, 403)
        }

        await userAccessQueries.revokeAccess(
          sql,
          body.user_id,
          body.entity_type,
          body.entity_id,
          body.role
        )

        return c.body(null, 204)
      })
    )

    // Get all access grants for a specific resource
    .get(
      '/:entityType/:entityId',
      zValidator('param', entityParamsSchema),
      (async (c) => {
        const userId = await reqAuthed(c);
        const { entityType, entityId } = c.req.valid('param')

        // Check if user has viewer access to the entity
        const hasAccess = await userAccessQueries.hasAccessToResource(
          sql,
          userId,
          entityType,
          entityId,
          'viewer'
        )

        if (!hasAccess) {
          return c.json({ error: 'Access denied' }, 403)
        }

        const access = await userAccessQueries.findAllUserAccessForEntity(sql, entityType, entityId)
        return c.json(access)
      })
    )

    // Get all access grants for a specific user
    .get(
      '/user/:userId',
      zValidator('param', userIdParamSchema),
      (async (c) => {
        const currentUserId = await reqAuthed(c);
        const { userId } = c.req.valid('param')

        // Only allow users to see their own access or if they are admins
        const isAdmin = await hasAdminAccess(sql, currentUserId)

        if (currentUserId !== userId && !isAdmin) {
          return c.json({ error: 'Access denied' }, 403)
        }

        const access = await userAccessQueries.findAllUserAccessForUser(sql, userId)
        return c.json(access)
      })
    )

    // Get projects accessible to current user
    .get('/user/:userId/projects', zValidator('param', userIdParamSchema), (async (c) => {
      const currentUserId = await reqAuthed(c);
      const { userId } = c.req.valid('param')

      // Only allow users to see their own projects
      if (currentUserId !== userId) {
        return c.json({ error: 'Access denied' }, 403)
      }

      const projectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
      return c.json({ project_ids: projectIds })
    }))

    // Cleanup expired access grants (admin endpoint)
    .post('/cleanup-expired', (async (c) => {
      await reqAdminAuthed(c, sql);
      const count = await userAccessQueries.cleanupExpiredAccess(sql)
      return c.json({ cleaned_up: count })
    }))
}
