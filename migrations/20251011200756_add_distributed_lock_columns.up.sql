-- Migration: add_distributed_lock_columns
-- Created: 2025-10-11 20:07:56

-- Add distributed lock columns to worker_task_cache
ALTER TABLE worker_task_cache
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN processing_worker_id VARCHAR(255);

-- Index for efficient lock queries
CREATE INDEX idx_worker_task_cache_processing
  ON worker_task_cache(processing_started_at)
  WHERE processing_started_at IS NOT NULL;
