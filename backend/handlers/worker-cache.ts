import { Hono } from 'hono'
import type { Sql } from 'postgres'
import { findAllWorkerCache } from '@db/worker-cache.ts'

export const createWorkerCacheRoutes = (sql: Sql) => {
  const app = new Hono()

  app.get('/', async (c) => {
    const cache = await findAllWorkerCache(sql)
    return c.json(cache)
  })

  return app
}
