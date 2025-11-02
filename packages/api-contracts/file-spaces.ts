/**
 * File Spaces API Contracts
 */

import { z } from 'zod'
import { route, type HandlerConfig } from '@adi-family/http'

// File space schema
const fileSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  project_id: z.string(),
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
} as const satisfies HandlerConfig

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
} as const satisfies HandlerConfig
