import { z } from 'zod'
import { route } from '@adi-family/http'

export const alertProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  missingProviders: z.array(z.string())
})

export const alertSchema = z.object({
  type: z.literal('missing_api_keys'),
  severity: z.literal('warning'),
  message: z.string(),
  providers: z.array(z.string()),
  projects: z.array(alertProjectSchema)
})

export const listAlertsResponseSchema = z.object({
  alerts: z.array(alertSchema)
})

export const listAlertsConfig = {
  method: 'GET',
  route: route.static('/api/alerts'),
  response: {
    schema: listAlertsResponseSchema
  }
} as const
