/**
 * File Spaces API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

// File space schema
const fileSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['gitlab', 'github']),
  project_id: z.string(),
  enabled: z.boolean(),
  config: z.any(), // FileSpaceConfig type
  created_at: z.string(),
  updated_at: z.string()
})

/**
 * List file spaces
 * GET /api/file-spaces?project_id=xxx
 */
export const listFileSpacesConfig = {
  method: 'GET',
  route: route.static('/api/file-spaces'),
  query: {
    schema: z.object({
      project_id: z.string().optional()
    })
  },
  response: {
    schema: z.array(fileSpaceSchema)
  }
} as const

/**
 * Get file space by ID
 * GET /api/file-spaces/:id
 */
export const getFileSpaceConfig = {
  method: 'GET',
  route: route.dynamic('/api/file-spaces/:id', z.object({ id: z.string() })),
  response: {
    schema: fileSpaceSchema
  }
} as const

/**
 * Create file space
 * POST /api/file-spaces
 */
export const createFileSpaceConfig = {
  method: 'POST',
  route: route.static('/api/file-spaces'),
  body: {
    schema: z.object({
      name: z.string(),
      type: z.enum(['gitlab', 'github']),
      project_id: z.string(),
      enabled: z.boolean().optional(),
      config: z.any()
    })
  },
  response: {
    schema: fileSpaceSchema
  }
} as const

/**
 * Get file spaces by task ID
 * GET /api/tasks/:id/file-spaces
 */
export const getTaskFileSpacesConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/:id/file-spaces', z.object({ id: z.string() })),
  response: {
    schema: z.array(fileSpaceSchema)
  }
} as const

/**
 * Update file space
 * PATCH /api/file-spaces/:id
 */
export const updateFileSpaceConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/file-spaces/:id', z.object({ id: z.string() })),
  body: {
    schema: z.object({
      name: z.string().optional(),
      type: z.string().optional(),
      enabled: z.boolean().optional(),
      config: z.any().optional()
    })
  },
  response: {
    schema: fileSpaceSchema
  }
} as const

/**
 * Delete file space
 * DELETE /api/file-spaces/:id
 */
export const deleteFileSpaceConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/file-spaces/:id', z.object({ id: z.string() })),
  response: {
    schema: z.object({ success: z.boolean() })
  }
} as const
