/**
 * File Spaces handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler, type HandlerContext } from '@adi-family/http'
import {
  listFileSpacesConfig,
  getFileSpaceConfig,
  createFileSpaceConfig,
  updateFileSpaceConfig,
  deleteFileSpaceConfig,
  getTaskFileSpacesConfig
} from '@adi/api-contracts/file-spaces'
import * as fileSpaceQueries from '@db/file-spaces'
import * as userAccessQueries from '@db/user-access'
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'file-spaces-handler' })

export function createFileSpaceHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: No Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw new Error('Unauthorized: Invalid token format')
    }

    if (!CLERK_SECRET_KEY) {
      throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
    }

    try {
      const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
      if (!payload.sub) {
        throw new Error('Unauthorized: Invalid token payload')
      }
      return payload.sub
    } catch (error) {
      logger.error('Token verification failed:', error)
      throw new Error('Unauthorized: Token verification failed')
    }
  }
  const listFileSpaces = handler(listFileSpacesConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { project_id } = ctx.query || {}

    if (project_id) {
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, project_id)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this project')
      }

      return fileSpaceQueries.findFileSpacesByProjectId(sql, project_id)
    }

    // List all file spaces from accessible projects
    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
    const allFileSpaces = await fileSpaceQueries.findAllFileSpaces(sql)
    return allFileSpaces.filter(fs => accessibleProjectIds.includes(fs.project_id))
  })

  const getFileSpace = handler(getFileSpaceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    const fileSpace = await fileSpaceQueries.findFileSpaceById(sql, id)
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, fileSpace.project_id)
    if (!hasAccess) {
      throw new Error('Forbidden: You do not have access to this file space')
    }

    return fileSpace
  })

  const createFileSpace = handler(createFileSpaceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { project_id } = ctx.body as any

    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You need admin role to create file spaces for this project')
    }

    return fileSpaceQueries.createFileSpace(sql, ctx.body as any)
  })

  const updateFileSpace = handler(updateFileSpaceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    const fileSpace = await fileSpaceQueries.findFileSpaceById(sql, id)
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, fileSpace.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You need admin role to update this file space')
    }

    return fileSpaceQueries.updateFileSpace(sql, id, ctx.body as any)
  })

  const deleteFileSpace = handler(deleteFileSpaceConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    const fileSpace = await fileSpaceQueries.findFileSpaceById(sql, id)
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, fileSpace.project_id, 'admin')
    if (!hasAccess) {
      throw new Error('Forbidden: You need admin role to delete this file space')
    }

    await fileSpaceQueries.deleteFileSpace(sql, id)
    return { success: true }
  })

  const getTaskFileSpaces = handler(getTaskFileSpacesConfig, async (ctx) => {
    const userId = await getUserId(ctx)
    const { id } = ctx.params

    // Get task's project and check access
    const fileSpaces = await fileSpaceQueries.findFileSpacesByTaskId(sql, id)
    if (fileSpaces.length > 0 && fileSpaces[0]) {
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, fileSpaces[0].project_id)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this task')
      }
    }

    return fileSpaces
  })

  return {
    listFileSpaces,
    getFileSpace,
    createFileSpace,
    updateFileSpace,
    deleteFileSpace,
    getTaskFileSpaces
  }
}
