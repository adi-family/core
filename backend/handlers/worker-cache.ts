import type { Context } from 'hono'
import type { Sql } from 'postgres'
import * as queries from '../queries/worker-cache'

export const createWorkerCacheHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const cache = await queries.findAllWorkerCache(sql)
    return c.json(cache)
  }
})
