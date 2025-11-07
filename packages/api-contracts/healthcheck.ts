import { z } from 'zod'
import { route } from '@adi-family/http'

export const healthcheckConfig = {
  method: 'GET',
  route: route.static('/healthcheck'),
  response: {
    schema: z.object({
      status: z.string(),
      timestamp: z.string()
    })
  }
} as const
