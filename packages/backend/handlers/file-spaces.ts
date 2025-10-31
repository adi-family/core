import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { zValidator } from '@hono/zod-validator'
import * as queries from '../../db/file-spaces'
import { idParamSchema, createFileSpaceSchema, updateFileSpaceSchema, projectIdQuerySchema } from '../schemas'
import { createFluentACL, AccessDeniedError } from '../middleware/fluent-acl'
import { reqAuthed } from '../middleware/authz'
import { isServiceAuthenticated } from '../middleware/service-auth'
import * as userAccessQueries from '../../db/user-access'
import { createLogger } from '@utils/logger'
import { triggerWorkspaceSync } from '../services/workspace-sync'

const logger = createLogger({ namespace: 'file-spaces' })

export const createFileSpaceRoutes = (sql: Sql) => {
  const acl = createFluentACL(sql)

  return new Hono()
    .get('/', zValidator('query', projectIdQuerySchema), async (c) => {
      const { project_id } = c.req.valid('query')

      const isService = isServiceAuthenticated(c)

      let userId: string | null = null
      if (!isService) {
        userId = await reqAuthed(c)
      }

      if (project_id) {
        if (!isService) {
          const hasAccess = await acl.project(project_id).viewer.gte.check(c)
          if (!hasAccess) {
            return c.json({ error: 'Insufficient permissions' }, 403)
          }
        }

        const fileSpaces = await queries.findFileSpacesByProjectId(sql, project_id)
        return c.json(fileSpaces)
      }

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

      const fileSpace = await queries.findFileSpaceById(sql, id)

      return c.json(fileSpace)
    })
    .post('/', zValidator('json', createFileSpaceSchema), async (c) => {
      const body = c.req.valid('json')

      const isService = isServiceAuthenticated(c)

      let userId: string | null = null
      if (!isService) {
        userId = await reqAuthed(c)
      }

      if (!isService) {
        try {
          await acl.project(body.project_id).developer.gte.throw(c)
        } catch (error) {
          if (error instanceof AccessDeniedError) {
            return c.json({ error: error.message }, error.statusCode as 401 | 403)
          }
          throw error
        }
      }

      const fileSpace = await queries.createFileSpace(sql, body)

      if (userId && !isService) {
        await userAccessQueries.grantAccess(sql, {
          user_id: userId,
          entity_type: 'file_space',
          entity_id: fileSpace.id,
          role: 'write',
          granted_by: userId,
        })
      }

      let syncTriggered = false
      let syncMessage: string | undefined

      try {
        const syncResult = await triggerWorkspaceSync(sql, {
          projectId: fileSpace.project_id
        })

        if (syncResult.success) {
          syncTriggered = true
          syncMessage = `Workspace sync pipeline triggered: ${syncResult.pipelineUrl}`
          logger.info(`✅ Triggered workspace sync for file space ${fileSpace.id}: ${syncResult.pipelineUrl}`)
        } else {
          syncMessage = `Workspace sync skipped: ${syncResult.error}`
          logger.warn(`⚠️  Workspace sync not triggered for file space ${fileSpace.id}: ${syncResult.error}`)
        }
      } catch (error) {
        syncMessage = `Workspace sync failed: ${error instanceof Error ? error.message : String(error)}`
        logger.error(`Failed to trigger workspace sync for file space ${fileSpace.id}:`, error)
      }

      return c.json({
        ...fileSpace,
        _meta: {
          workspace_sync_triggered: syncTriggered,
          workspace_sync_message: syncMessage
        }
      }, 201)
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

      const fileSpace = await queries.updateFileSpace(sql, id, body as import('../../types').UpdateFileSpaceInput)

      return c.json(fileSpace)
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

      await queries.deleteFileSpace(sql, id)

      return c.json({ success: true })
    })
    .post('/:id/sync', zValidator('param', idParamSchema), async (c) => {
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

      const fileSpace = await queries.findFileSpaceById(sql, id)

      // Trigger workspace sync for this file space's project
      logger.info(`Manual workspace sync requested for file space ${id}`)

      try {
        const syncResult = await triggerWorkspaceSync(sql, {
          projectId: fileSpace.project_id
        })

        if (syncResult.success) {
          return c.json({
            success: true,
            pipelineId: syncResult.pipelineId,
            pipelineUrl: syncResult.pipelineUrl,
            message: 'Workspace sync pipeline triggered successfully'
          })
        } else {
          return c.json({
            success: false,
            error: syncResult.error
          }, 400)
        }
      } catch (error) {
        logger.error(`Failed to trigger workspace sync for file space ${id}:`, error)
        return c.json({
          error: error instanceof Error ? error.message : 'Workspace sync failed'
        }, 500)
      }
    })
}
