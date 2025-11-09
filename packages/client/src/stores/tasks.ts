import { z } from 'zod'
import { proxy } from 'valtio'
import type { Task } from '@adi-simple/types'
import { taskSchema } from '@adi-simple/types'
import { listTasksConfig, createTaskConfig, deleteTaskConfig } from '@adi/api-contracts/tasks'
import type { BaseClient } from '@adi-family/http'

const _tasksStoreSchema = z.object({
  tasks: z.array(taskSchema),
  loading: z.boolean(),
  error: z.string().nullable(),
  lastFetch: z.number().nullable()
})

type TasksStore = z.infer<typeof _tasksStoreSchema>

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

/**
 * Create a new manual task
 */
export async function createTask(
  client: BaseClient,
  input: {
    title: string
    description?: string
    project_id: string
    status?: string
  }
): Promise<Task> {
  try {
    const task = await client.run(createTaskConfig, {
      body: input
    })

    // Add to local store
    tasksStore.tasks.unshift(task)

    return task
  } catch (error) {
    tasksStore.error = error instanceof Error ? error.message : 'Failed to create task'
    console.error('Error creating task:', error)
    throw error
  }
}

/**
 * Delete a task (only manual tasks can be deleted)
 */
export async function deleteTask(
  client: BaseClient,
  taskId: string
): Promise<void> {
  try {
    await client.run(deleteTaskConfig, {
      params: { id: taskId }
    })

    // Remove from local store
    const index = tasksStore.tasks.findIndex(t => t.id === taskId)
    if (index !== -1) {
      tasksStore.tasks.splice(index, 1)
    }
  } catch (error) {
    tasksStore.error = error instanceof Error ? error.message : 'Failed to delete task'
    console.error('Error deleting task:', error)
    throw error
  }
}

/**
 * Update a task in the local store
 */
export function updateTaskInStore(taskId: string, updates: Partial<Task>): void {
  const index = tasksStore.tasks.findIndex(t => t.id === taskId)
  if (index !== -1) {
    tasksStore.tasks[index] = { ...tasksStore.tasks[index], ...updates }
  }
}

/**
 * Add a task to the local store
 */
export function addTaskToStore(task: Task): void {
  const exists = tasksStore.tasks.some(t => t.id === task.id)
  if (!exists) {
    tasksStore.tasks.unshift(task)
  }
}

/**
 * Remove a task from the local store
 */
export function removeTaskFromStore(taskId: string): void {
  const index = tasksStore.tasks.findIndex(t => t.id === taskId)
  if (index !== -1) {
    tasksStore.tasks.splice(index, 1)
  }
}
