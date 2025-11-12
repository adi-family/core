/**
 * Custom Native HTTP Handler
 * Wraps @adi-family/http-native to add proper exception handling
 */

import type { IncomingMessage, ServerResponse } from 'http'
import type { Handler } from '@adi-family/http'
import { createHandler as baseCreateHandler } from '@adi-family/http-native'

/**
 * Intercept response to handle custom exceptions
 */
function interceptResponse(res: ServerResponse, originalEnd: any): void {
  const chunks: Buffer[] = []

  // Override write to capture response body
  const originalWrite = res.write.bind(res)
  res.write = function(chunk: any, ...args: any[]): boolean {
    if (chunk) {
      chunks.push(Buffer.from(chunk))
    }
    return originalWrite(chunk, ...args)
  } as any

  // Override end to inspect and modify the response
  res.end = function(chunk?: any, ...args: any[]): any {
    if (chunk) {
      chunks.push(Buffer.from(chunk))
    }

    // Check if this is a 500 error that should be remapped
    if (res.statusCode === 500 && chunks.length > 0) {
      try {
        const body = Buffer.concat(chunks).toString('utf-8')
        const json = JSON.parse(body)

        // Check if the error message matches our exceptions
        if (json.error === 'Internal Server Error' && json.message) {
          let newStatusCode: number | null = null
          let newError: string | null = null

          // Map exception messages to proper status codes
          // This is a heuristic approach since we can't access the original exception type
          if (json.message.includes('not found') || json.message.includes('Not found')) {
            newStatusCode = 404
            newError = 'Not Found'
          } else if (json.message.includes('Unauthorized') || json.message.includes('authentication required')) {
            newStatusCode = 401
            newError = 'Unauthorized'
          } else if (json.message.includes('Forbidden') || json.message.includes('not enough rights')) {
            newStatusCode = 403
            newError = 'Forbidden'
          } else if (json.message.includes('Bad request') || json.message.includes('Invalid')) {
            newStatusCode = 400
            newError = 'Bad Request'
          }

          if (newStatusCode && newError) {
            res.statusCode = newStatusCode
            const newBody = JSON.stringify({ error: newError, message: json.message })
            return originalEnd.call(res, newBody, ...args)
          }
        }
      } catch (_e) {
        // If we can't parse or modify, just pass through
      }
    }

    // Pass through as-is
    const fullBody = Buffer.concat(chunks)
    return originalEnd.call(res, fullBody, ...args)
  } as any
}

/**
 * Create a custom request handler with proper exception handling
 */
export function createHandler(handlers: Handler<any, any, any, any>[]): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const baseHandler = baseCreateHandler(handlers)

  return async (req: IncomingMessage, res: ServerResponse) => {
    // Intercept the response to handle custom exceptions
    const originalEnd = res.end.bind(res)
    interceptResponse(res, originalEnd)

    // Call the base handler
    await baseHandler(req, res)
  }
}
