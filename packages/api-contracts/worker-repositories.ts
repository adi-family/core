import { z } from 'zod'
import { route } from '@adi-family/http'

const gitLabSourceSchema = z.object({
  type: z.string(),
  project_id: z.string().optional(),
  project_path: z.string().optional(),
  host: z.string().optional(),
  user: z.string().optional(),
  access_token_encrypted: z.string().optional()
})

const workerRepositorySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  source_gitlab: gitLabSourceSchema,
  current_version: z.string().nullable(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date())
})

export const getWorkerRepositoryByProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/projects/:projectId/worker-repository', z.object({ projectId: z.string() })),
  response: {
    schema: workerRepositorySchema
  }
} as const

export const createWorkerRepositoryConfig = {
  method: 'POST',
  route: route.static('/api/worker-repositories'),
  body: {
    schema: z.object({
      project_id: z.string(),
      source_gitlab: gitLabSourceSchema,
      current_version: z.string()
    })
  },
  response: {
    schema: workerRepositorySchema
  }
} as const
