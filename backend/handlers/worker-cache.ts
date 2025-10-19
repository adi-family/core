import type { Context } from 'hono'
import type { Sql } from 'postgres'
import { findAllWorkerCache, initTrafficLight, type LockContext, type SignalInfo } from '@db/worker-cache.ts'

export const createWorkerCacheHandlers = (sql: Sql) => ({
  list: async (c: Context) => {
    const cache = await findAllWorkerCache(sql)
    return c.json(cache)
  },

  isSignaledBefore: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const { issueId, date } = await c.req.json<{ issueId: string; date: string }>()

    const trafficLight = initTrafficLight(sql, projectId)
    const result = await trafficLight.isSignaledBefore(issueId, new Date(date))

    return c.json({ signaled: result })
  },

  tryAcquireLock: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const lockContext = await c.req.json<LockContext>()

    const trafficLight = initTrafficLight(sql, projectId)
    const acquired = await trafficLight.tryAcquireLock(lockContext)

    return c.json({ acquired })
  },

  releaseLock: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const { issueId } = await c.req.json<{ issueId: string }>()

    const trafficLight = initTrafficLight(sql, projectId)
    await trafficLight.releaseLock(issueId)

    return c.json({ success: true })
  },

  signal: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const signalInfo = await c.req.json<SignalInfo>()

    const trafficLight = initTrafficLight(sql, projectId)
    await trafficLight.signal({
      ...signalInfo,
      date: new Date(signalInfo.date)
    })

    return c.json({ success: true })
  },

  getTaskId: async (c: Context) => {
    const projectId = c.req.param('projectId')
    const issueId = c.req.param('issueId')

    const trafficLight = initTrafficLight(sql, projectId)
    const taskId = await trafficLight.getTaskId(issueId)

    return c.json({ taskId })
  }
})
