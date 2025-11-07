import { handler } from '@adi-family/http'
import { healthcheckConfig } from '@adi/api-contracts/healthcheck'

export function createCommonHandlers() {
  const healthcheck = handler(healthcheckConfig, async (_ctx) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  })

  return {
    healthcheck
  }
}
