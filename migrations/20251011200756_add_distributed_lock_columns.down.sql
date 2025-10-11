-- Rollback: add_distributed_lock_columns
-- Created: 2025-10-11 20:07:56

DROP INDEX IF EXISTS idx_worker_task_cache_processing;

ALTER TABLE worker_task_cache
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS processing_worker_id;
