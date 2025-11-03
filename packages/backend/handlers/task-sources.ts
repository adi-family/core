/**
 * Task Sources API handlers
 */

import { handler } from '@adi-family/http'
import { listTaskSourcesConfig, syncTaskSourceConfig } from '@adi/api-contracts/task-sources'
import type { Sql } from 'postgres'

/**
 * Create task source handlers
 */
export function createTaskSourceHandlers(sql: Sql) {
  /**
   * GET /api/task-sources
   * List all task sources
   */
  const listTaskSources = handler(listTaskSourcesConfig, async ({ query }) => {
    const projectId = query?.project_id

    if (projectId) {
      const taskSources = await sql`
        SELECT * FROM task_sources
        WHERE project_id = ${projectId}
        ORDER BY created_at DESC
      `
      return taskSources
    }

    const taskSources = await sql`
      SELECT * FROM task_sources
      ORDER BY created_at DESC
    `
    return taskSources
  })

  /**
   * POST /api/task-sources/:id/sync
   * Trigger sync for a task source
   */
  const syncTaskSource = handler(syncTaskSourceConfig, async ({ params }) => {
    const { id } = params

    // TODO: Queue sync job via message queue/RabbitMQ
    // For now, just return success message
    return {
      success: true,
      message: `Task source ${id} sync queued successfully`
    }
  })

  return {
    listTaskSources,
    syncTaskSource,
  }
}
