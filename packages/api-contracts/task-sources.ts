/**
 * Task Sources API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * List task sources
 * GET /api/task-sources
 */
export const listTaskSourcesConfig = {
  method: 'GET',
  route: route.static('/api/task-sources'),
  query: {
    schema: z.object({
      project_id: z.string().optional()
    }).optional()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Get task source by ID
 * GET /api/task-sources/:id
 */
export const getTaskSourceConfig = {
  method: 'GET',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  response: {
    schema: z.any()
  }
} as const

/**
 * Create task source
 * POST /api/task-sources
 */
export const createTaskSourceConfig = {
  method: 'POST',
  route: route.static('/api/task-sources'),
  body: {
    schema: z.any()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Update task source
 * PATCH /api/task-sources/:id
 */
export const updateTaskSourceConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  body: {
    schema: z.any()
  },
  response: {
    schema: z.any()
  }
} as const

/**
 * Sync task source
 * POST /api/task-sources/:id/sync
 */
export const syncTaskSourceConfig = {
  method: 'POST',
  route: route.dynamic('/api/task-sources/:id/sync', z.object({ id: z.string() })),
  body: {
    schema: z.any().optional()
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string()
    })
  }
} as const

/**
 * Delete task source
 * DELETE /api/task-sources/:id
 */
export const deleteTaskSourceConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  response: {
    schema: z.object({ success: z.boolean() })
  }
} as const
