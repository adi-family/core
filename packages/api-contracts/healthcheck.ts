import { z } from 'zod'
import { route } from '@adi-family/http'

export const healthcheckResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string()
})

export const healthcheckConfig = {
  method: 'GET',
  route: route.static('/healthcheck'),
  response: {
    schema: healthcheckResponseSchema
  }
} as const
