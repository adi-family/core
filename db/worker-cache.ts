import type { Sql } from 'postgres';

export type WorkerCache = {
  id: number;
  issue_id: string;
  project_id: string;
  last_processed_at: Date;
  status: string | null;
  task_id: string | null;
  processing_started_at: Date | null;
  processing_worker_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type LockContext = {
  issueId: string;
  workerId: string;
  lockTimeoutSeconds?: number;
};

export type SignalInfo = {
  issueId: string;
  date: Date;
  taskId: string;
};

export const findAllWorkerCache = async (sql: Sql): Promise<WorkerCache[]> => {
  const rows = await sql<WorkerCache[]>`
    SELECT *
    FROM worker_task_cache
    ORDER BY updated_at DESC
  `;
  return rows;
};

export function initTrafficLight(sql: Sql, projectId: string) {
  return {
    isSignaledBefore: async (issueId: string, date: Date): Promise<boolean> => {
      const result = await sql`
        SELECT last_processed_at
        FROM worker_task_cache
        WHERE issue_id = ${issueId} AND project_id = ${projectId}
      `;

      const row = result[0];
      if (!row) {
        return false;
      }

      const lastProcessed = new Date(row.last_processed_at);
      return lastProcessed >= date;
    },
    tryAcquireLock: async (ctx: LockContext): Promise<boolean> => {
      const lockTimeoutSeconds = ctx.lockTimeoutSeconds !== undefined ? ctx.lockTimeoutSeconds : 3600;
      const result = await sql`
        INSERT INTO worker_task_cache (issue_id, project_id, processing_started_at, processing_worker_id, status)
        VALUES (${ctx.issueId}, ${projectId}, NOW(), ${ctx.workerId}, 'processing')
        ON CONFLICT (issue_id, project_id)
        DO UPDATE SET
          processing_started_at = NOW(),
          processing_worker_id = ${ctx.workerId},
          status = 'processing',
          updated_at = NOW()
        WHERE worker_task_cache.processing_started_at IS NULL
           OR worker_task_cache.processing_started_at < NOW() - (INTERVAL '1 second' * ${lockTimeoutSeconds})
        RETURNING id
      `;

      return result.length > 0;
    },
    releaseLock: async (issueId: string): Promise<void> => {
      await sql`
        UPDATE worker_task_cache
        SET
          processing_started_at = NULL,
          processing_worker_id = NULL,
          updated_at = NOW()
        WHERE issue_id = ${issueId} AND project_id = ${projectId}
      `;
    },
    signal: async (info: SignalInfo): Promise<void> => {
      await sql`
        INSERT INTO worker_task_cache (issue_id, project_id, last_processed_at, status, task_id, processing_started_at, processing_worker_id)
        VALUES (${info.issueId}, ${projectId}, ${info.date}, 'completed', ${info.taskId}, NULL, NULL)
        ON CONFLICT (issue_id, project_id)
        DO UPDATE SET
          last_processed_at = ${info.date},
          status = 'completed',
          task_id = ${info.taskId},
          processing_started_at = NULL,
          processing_worker_id = NULL,
          updated_at = NOW()
      `;
    },
    getTaskId: async (issueId: string): Promise<string | null> => {
      const result = await sql`
        SELECT task_id
        FROM worker_task_cache
        WHERE issue_id = ${issueId} AND project_id = ${projectId}
      `;

      const row = result[0];
      if (!row) {
        return null;
      }

      return row.task_id;
    }
  };
}
