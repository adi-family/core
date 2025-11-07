import { proxy } from 'valtio'
import type { TaskSource } from '@adi-simple/types'
import { listTaskSourcesConfig, syncTaskSourceConfig } from '@adi/api-contracts'
import type { BaseClient } from '@adi-family/http'

interface TaskSourcesStore {
  taskSources: TaskSource[]
  loading: boolean
  error: string | null
  lastFetch: number | null
}

export const taskSourcesStore = proxy<TaskSourcesStore>({
  taskSources: [],
  loading: false,
  error: null,
  lastFetch: null,
})

/**
 * Fetch task sources from the API
 * Supports optional filtering by project_id
 * Caches results to avoid duplicate calls within 30 seconds
 */
export async function fetchTaskSources(
  client: BaseClient,
  options?: {
    project_id?: string
    force?: boolean
  }
) {
  const now = Date.now()
  const CACHE_DURATION = 30_000 // 30 seconds

  // Skip if recently fetched (unless forced)
  if (!options?.force && taskSourcesStore.lastFetch && now - taskSourcesStore.lastFetch < CACHE_DURATION) {
    return
  }

  taskSourcesStore.loading = true
  taskSourcesStore.error = null

  try {
    const data = await client.run(listTaskSourcesConfig, {
      query: {
        project_id: options?.project_id,
      }
    })
    console.log('[TaskSourcesStore] Fetched task sources:', data)
    taskSourcesStore.taskSources = data
    taskSourcesStore.lastFetch = now
  } catch (error) {
    taskSourcesStore.error = error instanceof Error ? error.message : 'Failed to fetch task sources'
    console.error('[TaskSourcesStore] Error fetching task sources:', error)
    throw error
  } finally {
    taskSourcesStore.loading = false
  }
}

/**
 * Sync a task source
 */
export async function syncTaskSource(
  client: BaseClient,
  taskSourceId: string
) {
  const taskSource = taskSourcesStore.taskSources.find((ts) => ts.id === taskSourceId)
  if (!taskSource) return

  const originalStatus = taskSource.sync_status

  // Optimistic update
  taskSource.sync_status = 'queued'

  try {
    await client.run(syncTaskSourceConfig, {
      params: { id: taskSourceId },
      body: {}
    })
  } catch (error) {
    // Revert on error
    taskSource.sync_status = originalStatus
    console.error('Error syncing task source:', error)
    throw error
  }
}

/**
 * Force refresh task sources from API
 */
export async function refreshTaskSources(
  client: BaseClient,
  options?: {
    project_id?: string
  }
) {
  return fetchTaskSources(client, { ...options, force: true })
}

/**
 * Get task sources filtered by project
 */
export function getTaskSourcesByProject(projectId: string | null): TaskSource[] {
  if (!projectId) return taskSourcesStore.taskSources
  return taskSourcesStore.taskSources.filter(ts => ts.project_id === projectId)
}
