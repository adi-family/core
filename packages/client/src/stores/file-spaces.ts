/**
 * Global File Spaces Store - Valtio state management
 *
 * Provides centralized state for file spaces (repositories) across the application.
 */
import { z } from 'zod'
import { proxy } from 'valtio'
import type { FileSpace } from '@adi-simple/types'
import { fileSpaceSchema } from '@adi-simple/types'
import { listFileSpacesConfig } from '@adi/api-contracts'
import type { BaseClient } from '@adi-family/http'

const _fileSpacesStoreSchema = z.object({
  fileSpaces: z.array(fileSpaceSchema),
  loading: z.boolean(),
  error: z.string().nullable(),
  lastFetch: z.number().nullable()
})

type FileSpacesStore = z.infer<typeof _fileSpacesStoreSchema>

export const fileSpacesStore = proxy<FileSpacesStore>({
  fileSpaces: [],
  loading: false,
  error: null,
  lastFetch: null,
})

/**
 * Fetch file spaces from the API
 * Supports optional filtering by project_id
 * Caches results to avoid duplicate calls within 30 seconds
 */
export async function fetchFileSpaces(
  client: BaseClient,
  options?: {
    project_id?: string
    force?: boolean
  }
) {
  const now = Date.now()
  const CACHE_DURATION = 30_000 // 30 seconds

  // Skip if recently fetched (unless forced)
  if (!options?.force && fileSpacesStore.lastFetch && now - fileSpacesStore.lastFetch < CACHE_DURATION) {
    return
  }

  fileSpacesStore.loading = true
  fileSpacesStore.error = null

  try {
    const data = await client.run(listFileSpacesConfig, {
      query: {
        project_id: options?.project_id,
      }
    })
    fileSpacesStore.fileSpaces = data
    fileSpacesStore.lastFetch = now
  } catch (error) {
    fileSpacesStore.error = error instanceof Error ? error.message : 'Failed to fetch file spaces'
    console.error('Error fetching file spaces:', error)
  } finally {
    fileSpacesStore.loading = false
  }
}

/**
 * Force refresh file spaces from API
 */
export async function refreshFileSpaces(
  client: BaseClient,
  options?: {
    project_id?: string
  }
) {
  return fetchFileSpaces(client, { ...options, force: true })
}

/**
 * Get file spaces filtered by project
 */
export function getFileSpacesByProject(projectId: string | null): FileSpace[] {
  if (!projectId) return fileSpacesStore.fileSpaces
  return fileSpacesStore.fileSpaces.filter(fs => fs.project_id === projectId)
}
