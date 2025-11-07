DROP INDEX IF EXISTS idx_worker_task_cache_processing;

ALTER TABLE worker_task_cache
  DROP COLUMN IF EXISTS processing_started_at,
  DROP COLUMN IF EXISTS processing_worker_id;
