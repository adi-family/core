ALTER TABLE worker_task_cache
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN processing_worker_id VARCHAR(255);

CREATE INDEX idx_worker_task_cache_processing
  ON worker_task_cache(processing_started_at)
  WHERE processing_started_at IS NOT NULL;
