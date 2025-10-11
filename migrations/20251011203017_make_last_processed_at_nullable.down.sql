-- Rollback: make_last_processed_at_nullable
-- Created: 2025-10-11 20:30:17

ALTER TABLE worker_task_cache ALTER COLUMN last_processed_at SET NOT NULL;
