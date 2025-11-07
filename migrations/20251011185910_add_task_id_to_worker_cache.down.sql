DROP INDEX IF EXISTS idx_worker_task_cache_task_id;
ALTER TABLE worker_task_cache DROP COLUMN IF EXISTS task_id;
