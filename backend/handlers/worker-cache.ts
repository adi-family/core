import type { Context } from 'hono'
import type { Sql } from 'postgres'
import { findAllWorkerCache } from '../../db/worker-cache'

export const createWorkerCacheHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const cache = await findAllWorkerCache(sql)
    return c.json(cache)
  }
})
