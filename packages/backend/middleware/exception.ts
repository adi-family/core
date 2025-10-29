import type {Context, Next} from "hono";
import {AuthRequiredException, NotFoundException} from "@utils/exceptions.ts";
import {AccessDeniedError} from "@backend/middleware/fluent-acl.ts";

export async function exceptionRecoverer(c: Context, next: Next) {
  try {
    return await next()
  } catch (error) {
    if (error instanceof AuthRequiredException) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    if (error instanceof AccessDeniedError) {
      return c.json({ error: error.message }, error.statusCode as 401 | 403)
    }

    if (error instanceof NotFoundException) {
      return c.json({ error: error.message || 'Not found' }, 404)
    }
  }
}
