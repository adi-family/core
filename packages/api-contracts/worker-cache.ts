import { z } from 'zod'
import { route } from '@adi-family/http'

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

export type WorkerCacheResponse = z.infer<typeof workerCacheSchema>

export const getWorkerCacheConfig = {
  method: 'GET',
  route: route.static('/api/worker-cache'),
  response: {
    schema: z.array(workerCacheSchema)
  }
} as const
