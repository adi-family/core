/**
 * Worker Cache API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * Worker cache entry schema
 */
const workerCacheSchema = z.object({
  id: z.number(),
  issue_id: z.string(),
  project_id: z.string(),
  last_processed_at: z.string(),
  status: z.string().nullable(),
  task_id: z.string().nullable(),
  processing_started_at: z.string().nullable(),
  processing_worker_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

/**
 * Worker cache entry type (inferred from schema)
 */
export type WorkerCacheResponse = z.infer<typeof workerCacheSchema>

/**
 * Get worker cache entries
 * GET /api/worker-cache
 */
export const getWorkerCacheConfig = {
  method: 'GET',
  route: route.static('/api/worker-cache'),
  response: {
    schema: z.array(workerCacheSchema)
  }
} as const
