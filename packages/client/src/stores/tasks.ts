import { z } from 'zod'
import { proxy } from 'valtio'
import type { Task } from '@adi-simple/types'
import { taskSchema } from '@adi-simple/types'
import { listTasksConfig } from '@adi/api-contracts'
import type { BaseClient } from '@adi-family/http'

const tasksStoreSchema = z.object({
  tasks: z.array(taskSchema),
  loading: z.boolean(),
  error: z.string().nullable(),
  lastFetch: z.number().nullable()
})

type TasksStore = z.infer<typeof tasksStoreSchema>

export const tasksStore = proxy<TasksStore>({
  tasks: [],
  loading: false,
  error: null,
  lastFetch: null,
})

export async function fetchTasks(
  client: BaseClient,
  options?: {
    project_id?: string
    status?: string
    limit?: number
    force?: boolean
  }
) {
  const now = Date.now()
  const CACHE_DURATION = 30_000 // 30 seconds

  // Skip if recently fetched (unless forced)
  if (!options?.force && tasksStore.lastFetch && now - tasksStore.lastFetch < CACHE_DURATION) {
    return
  }

  tasksStore.loading = true
  tasksStore.error = null

  try {
    const data = await client.run(listTasksConfig, {
      query: {
        project_id: options?.project_id,
        status: options?.status,
        limit: options?.limit,
      }
    })
    tasksStore.tasks = Array.isArray(data) ? data : []
    tasksStore.lastFetch = now
  } catch (error) {
    tasksStore.error = error instanceof Error ? error.message : 'Failed to fetch tasks'
    console.error('Error fetching tasks:', error)
  } finally {
    tasksStore.loading = false
  }
}

/**
 * Force refresh tasks from API
 */
export async function refreshTasks(
  client: BaseClient,
  options?: {
    project_id?: string
    status?: string
    limit?: number
  }
) {
  return fetchTasks(client, { ...options, force: true })
}

/**
 * Get tasks filtered by project
 */
export function getTasksByProject(projectId: string | null): Task[] {
  if (!projectId) return tasksStore.tasks
  return tasksStore.tasks.filter(t => t.project_id === projectId)
}
