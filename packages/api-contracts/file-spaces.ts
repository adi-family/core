import { z } from 'zod'
import { route } from '@adi-family/http'

export const fileSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['gitlab', 'github']),
  project_id: z.string(),
  enabled: z.boolean(),
  default_branch: z.string().optional(),
  config: z.any(), // FileSpaceConfig type
  created_at: z.string(),
  updated_at: z.string()
})

export const listFileSpacesQuerySchema = z.object({
  project_id: z.string().optional()
})

export const listFileSpacesConfig = {
  method: 'GET',
  route: route.static('/api/file-spaces'),
  query: {
    schema: listFileSpacesQuerySchema,
  },
  response: {
    schema: z.array(fileSpaceSchema)
  },
} as const

export const getFileSpaceConfig = {
  method: 'GET',
  route: route.dynamic('/api/file-spaces/:id', z.object({ id: z.string() })),
  response: {
    schema: fileSpaceSchema
  }
} as const

export const createFileSpaceBodySchema = z.object({
  name: z.string(),
  type: z.enum(['gitlab', 'github']),
  project_id: z.string(),
  enabled: z.boolean().optional(),
  default_branch: z.string().optional(),
  config: z.any()
})

/**
 * Create file space
 * POST /api/file-spaces
 */
export const createFileSpaceConfig = {
  method: 'POST',
  route: route.static('/api/file-spaces'),
  body: {
    schema: createFileSpaceBodySchema
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

export const updateFileSpaceBodySchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  enabled: z.boolean().optional(),
  default_branch: z.string().optional(),
  config: z.any().optional()
})

/**
 * Update file space
 * PATCH /api/file-spaces/:id
 */
export const updateFileSpaceConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/file-spaces/:id', z.object({ id: z.string() })),
  body: {
    schema: updateFileSpaceBodySchema
  },
  response: {
    schema: fileSpaceSchema
  }
} as const

export const deleteFileSpaceResponseSchema = z.object({ success: z.boolean() })

/**
 * Delete file space
 * DELETE /api/file-spaces/:id
 */
export const deleteFileSpaceConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/file-spaces/:id', z.object({ id: z.string() })),
  response: {
    schema: deleteFileSpaceResponseSchema
  }
} as const
