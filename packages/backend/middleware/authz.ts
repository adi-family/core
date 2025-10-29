import type { Context } from 'hono'
import type { Sql } from 'postgres'
import { getAuth } from '@hono/clerk-auth'
import { createLogger } from '@utils/logger'
import { hasAdminAccess } from '@db/user-access.ts'
import {AuthRequiredException, NotEnoughRightsException} from "@utils/exceptions.ts";

const logger = createLogger({ namespace: 'auth' })

export async function reqAuthed(c: Context): Promise<string> {
  const auth = getAuth(c)
  if (!auth?.userId) {
    throw new AuthRequiredException();
  }
  return auth.userId;
}

export async function reqAdminAuthed(c: Context, sql: Sql): Promise<string> {
  const userId = await reqAuthed(c);

  const adminAccess = await hasAdminAccess(sql, userId)
  if (!adminAccess) {
    logger.warn(`Unauthorized access attempt by user: ${userId}`)
    throw new NotEnoughRightsException();
  }

  return userId;
}
