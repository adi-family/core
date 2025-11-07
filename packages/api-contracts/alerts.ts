import { z } from 'zod'
import { route } from '@adi-family/http'

export const listAlertsConfig = {
  method: 'GET',
  route: route.static('/api/alerts'),
  response: {
    schema: z.object({
      alerts: z.array(z.object({
        type: z.literal('missing_api_keys'),
        severity: z.literal('warning'),
        message: z.string(),
        providers: z.array(z.string()),
        projects: z.array(z.object({
          id: z.string(),
          name: z.string(),
          missingProviders: z.array(z.string())
        }))
      }))
    })
  }
} as const
