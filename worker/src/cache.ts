import { sql } from './db';

export function initTrafficLight(repo: string) {
  return {
    isSignaledBefore: async (issueId: string, date: Date): Promise<boolean> => {
      const result = await sql`
        SELECT last_processed_at
        FROM worker_task_cache
        WHERE issue_id = ${issueId} AND repo = ${repo}
      `;

      if (result.length === 0) {
        return false;
      }

      const lastProcessed = new Date(result[0].last_processed_at);
      return lastProcessed >= date;
    },
    tryAcquireLock: async (issueId: string, workerId: string, lockTimeoutSeconds: number = 3600): Promise<boolean> => {
      const result = await sql`
        INSERT INTO worker_task_cache (issue_id, repo, processing_started_at, processing_worker_id, status)
        VALUES (${issueId}, ${repo}, NOW(), ${workerId}, 'processing')
        ON CONFLICT (issue_id, repo)
        DO UPDATE SET
          processing_started_at = NOW(),
          processing_worker_id = ${workerId},
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
        WHERE issue_id = ${issueId} AND repo = ${repo}
      `;
    },
    signal: async (issueId: string, date: Date, taskId: string): Promise<void> => {
      await sql`
        INSERT INTO worker_task_cache (issue_id, repo, last_processed_at, status, task_id, processing_started_at, processing_worker_id)
        VALUES (${issueId}, ${repo}, ${date}, 'completed', ${taskId}, NULL, NULL)
        ON CONFLICT (issue_id, repo)
        DO UPDATE SET
          last_processed_at = ${date},
          status = 'completed',
          task_id = ${taskId},
          processing_started_at = NULL,
          processing_worker_id = NULL,
          updated_at = NOW()
      `;
    },
    getTaskId: async (issueId: string): Promise<string | null> => {
      const result = await sql`
        SELECT task_id
        FROM worker_task_cache
        WHERE issue_id = ${issueId} AND repo = ${repo}
      `;

      if (result.length === 0) {
        return null;
      }

      return result[0].task_id;
    }
  };
}
