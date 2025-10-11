-- Rollback: add_task_id_to_worker_cache
-- Created: 2025-10-11 18:59:10

DROP INDEX IF EXISTS idx_worker_task_cache_task_id;
ALTER TABLE worker_task_cache DROP COLUMN IF EXISTS task_id;
