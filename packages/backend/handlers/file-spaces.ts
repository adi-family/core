/**
 * File Spaces handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
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
import { authenticate } from '../utils/auth'

export { authResultSchema, type AuthResult } from '../utils/auth'

export function createFileSpaceHandlers(sql: Sql) {
  const listFileSpaces = handler(listFileSpacesConfig, async (ctx) => {
    const auth = await authenticate(sql, ctx)
    const { project_id } = ctx.query || {}

    if (auth.isApiKey) {
      if (project_id && project_id !== auth.projectId) {
        throw new Error('Forbidden: API key does not have access to this project')
      }
      return fileSpaceQueries.findFileSpacesByProjectId(sql, auth.projectId!)
    }

    if (project_id) {
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, auth.userId!, project_id)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this project')
      }

      return fileSpaceQueries.findFileSpacesByProjectId(sql, project_id)
    }

    const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, auth.userId!)
    const allFileSpaces = await fileSpaceQueries.findAllFileSpaces(sql)
    return allFileSpaces.filter(fs => accessibleProjectIds.includes(fs.project_id))
  })

  const getFileSpace = handler(getFileSpaceConfig, async (ctx) => {
    const auth = await authenticate(sql, ctx)
    const { id } = ctx.params

    const fileSpace = await fileSpaceQueries.findFileSpaceById(sql, id)

    if (auth.isApiKey) {
      if (fileSpace.project_id !== auth.projectId) {
        throw new Error('Forbidden: API key does not have access to this file space')
      }
    } else {
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, auth.userId!, fileSpace.project_id)
      if (!hasAccess) {
        throw new Error('Forbidden: You do not have access to this file space')
      }
    }

    return fileSpace
  })

  const createFileSpace = handler(createFileSpaceConfig, async (ctx) => {
    const auth = await authenticate(sql, ctx)
    const { project_id } = ctx.body

    if (auth.isApiKey) {
      if (project_id !== auth.projectId) {
        throw new Error('Forbidden: API key does not have access to this project')
      }
      // API keys don't have admin role concept, just check they have write permission
      // For now, we'll allow it if they have read_project permission
    } else {
      // Clerk authentication - check user has admin access
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, auth.userId!, project_id, 'admin')
      if (!hasAccess) {
        throw new Error('Forbidden: You need admin role to create file spaces for this project')
      }
    }

    return fileSpaceQueries.createFileSpace(sql, ctx.body as Parameters<typeof fileSpaceQueries.createFileSpace>[1])
  })

  const updateFileSpace = handler(updateFileSpaceConfig, async (ctx) => {
    const auth = await authenticate(sql, ctx)
    const { id } = ctx.params

    const fileSpace = await fileSpaceQueries.findFileSpaceById(sql, id)

    // API key authentication - check project match
    if (auth.isApiKey) {
      if (fileSpace.project_id !== auth.projectId) {
        throw new Error('Forbidden: API key does not have access to this file space')
      }
    } else {
      // Clerk authentication - check user has admin access
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, auth.userId!, fileSpace.project_id, 'admin')
      if (!hasAccess) {
        throw new Error('Forbidden: You need admin role to update this file space')
      }
    }

    return fileSpaceQueries.updateFileSpace(sql, id, ctx.body as Parameters<typeof fileSpaceQueries.updateFileSpace>[2])
  })

  const deleteFileSpace = handler(deleteFileSpaceConfig, async (ctx) => {
    const auth = await authenticate(sql, ctx)
    const { id } = ctx.params

    const fileSpace = await fileSpaceQueries.findFileSpaceById(sql, id)

    // API key authentication - check project match
    if (auth.isApiKey) {
      if (fileSpace.project_id !== auth.projectId) {
        throw new Error('Forbidden: API key does not have access to this file space')
      }
    } else {
      // Clerk authentication - check user has admin access
      const hasAccess = await userAccessQueries.hasProjectAccess(sql, auth.userId!, fileSpace.project_id, 'admin')
      if (!hasAccess) {
        throw new Error('Forbidden: You need admin role to delete this file space')
      }
    }

    await fileSpaceQueries.deleteFileSpace(sql, id)
    return { success: true }
  })

  const getTaskFileSpaces = handler(getTaskFileSpacesConfig, async (ctx) => {
    const auth = await authenticate(sql, ctx)
    const { id } = ctx.params

    // Get task's project and check access
    const fileSpaces = await fileSpaceQueries.findFileSpacesByTaskId(sql, id)
    if (fileSpaces.length > 0 && fileSpaces[0]) {
      if (auth.isApiKey) {
        if (fileSpaces[0].project_id !== auth.projectId) {
          throw new Error('Forbidden: API key does not have access to this task')
        }
      } else {
        const hasAccess = await userAccessQueries.hasProjectAccess(sql, auth.userId!, fileSpaces[0].project_id)
        if (!hasAccess) throw new Error('Forbidden: You do not have access to this task')
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
