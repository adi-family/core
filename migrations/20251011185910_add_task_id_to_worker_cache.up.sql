-- Migration: add_task_id_to_worker_cache
-- Created: 2025-10-11 18:59:10

ALTER TABLE worker_task_cache ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX idx_worker_task_cache_task_id ON worker_task_cache(task_id);
