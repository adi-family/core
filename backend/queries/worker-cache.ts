import type { Sql } from 'postgres'

export type WorkerCache = {
  id: number
  issue_id: string
  repo: string
  last_processed_at: Date
  status: string | null
  task_id: string | null
  processing_started_at: Date | null
  processing_worker_id: string | null
  created_at: Date
  updated_at: Date
}

export const findAllWorkerCache = async (sql: Sql): Promise<WorkerCache[]> => {
  const rows = await sql<WorkerCache[]>`
    SELECT *
    FROM worker_task_cache
    ORDER BY updated_at DESC
  `
  return rows
}
