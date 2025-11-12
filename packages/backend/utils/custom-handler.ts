/**
 * Custom handler wrapper that adds proper error handling for our exceptions
 * This wraps the @adi-family/http handlers to properly map exceptions to HTTP status codes
 */

import type { Handler, HandlerConfig, HandlerFunction } from '@adi-family/http'
import { handler as baseHandler } from '@adi-family/http'
import { NotFoundException, BadRequestException, NotEnoughRightsException, AuthRequiredException } from '@utils/exceptions'

/**
 * Custom handler that wraps the base handler with proper error handling
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function handler<TParams = {}, TQuery = {}, TBody = unknown, TResponse = unknown>(
  config: HandlerConfig<TParams, TQuery, TBody, TResponse>,
  fn: HandlerFunction<TParams, TQuery, TBody, TResponse>
): Handler<TParams, TQuery, TBody, TResponse> {
  // Wrap the handler function with error handling
  const wrappedFn: HandlerFunction<TParams, TQuery, TBody, TResponse> = async (ctx) => {
    try {
      return await fn(ctx)
    } catch (error) {
      // Map our custom exceptions to proper HTTP errors
      // We'll add a special property to mark them for the adapter
      if (error instanceof NotFoundException) {
        const httpError: any = new Error(error.message)
        httpError.statusCode = 404
        httpError.name = 'NotFoundException'
        throw httpError
      }

      if (error instanceof BadRequestException) {
        const httpError: any = new Error(error.message)
        httpError.statusCode = 400
        httpError.name = 'BadRequestException'
        throw httpError
      }

      if (error instanceof AuthRequiredException) {
        const httpError: any = new Error(error.message)
        httpError.statusCode = 401
        httpError.name = 'AuthRequiredException'
        throw httpError
      }

      if (error instanceof NotEnoughRightsException) {
        const httpError: any = new Error(error.message)
        httpError.statusCode = 403
        httpError.name = 'NotEnoughRightsException'
        throw httpError
      }

      // Re-throw other errors unchanged
      throw error
    }
  }

  return baseHandler(config, wrappedFn)
}
