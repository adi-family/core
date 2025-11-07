import type { BaseClient } from '@adi-family/http'
import { z } from 'zod'
import { proxy } from 'valtio'
import type { Project } from '@adi-simple/types'
import { projectSchema } from '@adi-simple/types'
import { listProjectsConfig, updateProjectConfig } from '@adi/api-contracts'

const projectsStoreSchema = z.object({
  projects: z.array(projectSchema),
  loading: z.boolean(),
  error: z.string().nullable(),
  lastFetch: z.number().nullable()
})

type ProjectsStore = z.infer<typeof projectsStoreSchema>

export const projectsStore = proxy<ProjectsStore>({
  projects: [],
  loading: false,
  error: null,
  lastFetch: null,
})

/**
 * Fetch projects from the API
 * Caches results to avoid duplicate calls within 30 seconds
 */
export async function fetchProjects(client: BaseClient, force = false) {
  const now = Date.now()
  const CACHE_DURATION = 30_000 // 30 seconds

  // Skip if recently fetched (unless forced)
  if (!force && projectsStore.lastFetch && now - projectsStore.lastFetch < CACHE_DURATION) {
    return
  }

  projectsStore.loading = true
  projectsStore.error = null

  try {
    const data = await client.run(listProjectsConfig)
    projectsStore.projects = data
    projectsStore.lastFetch = now
  } catch (error) {
    projectsStore.error = error instanceof Error ? error.message : 'Failed to fetch projects'
    console.error('Error fetching projects:', error)
  } finally {
    projectsStore.loading = false
  }
}

/**
 * Toggle project enabled status
 * Optimistically updates local state
 */
export async function toggleProjectEnabled(
  client: BaseClient,
  projectId: string
) {
  const project = projectsStore.projects.find((p) => p.id === projectId)
  if (!project) return

  const originalEnabled = project.enabled

  // Optimistic update
  project.enabled = !project.enabled

  try {
    await client.run(updateProjectConfig, {
      params: { id: projectId },
      body: { enabled: !originalEnabled },
    })
  } catch (error) {
    // Revert on error
    project.enabled = originalEnabled
    console.error('Error toggling project:', error)
    throw error
  }
}

/**
 * Force refresh projects from API
 */
export async function refreshProjects(client: BaseClient) {
  return fetchProjects(client, true)
}
