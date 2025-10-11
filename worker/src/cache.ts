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
    signal: async (issueId: string, date: Date, taskId: string): Promise<void> => {
      await sql`
        INSERT INTO worker_task_cache (issue_id, repo, last_processed_at, status, task_id)
        VALUES (${issueId}, ${repo}, ${date}, 'completed', ${taskId})
        ON CONFLICT (issue_id, repo)
        DO UPDATE SET
          last_processed_at = ${date},
          status = 'completed',
          task_id = ${taskId},
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
