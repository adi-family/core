ALTER TABLE worker_task_cache ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
CREATE INDEX idx_worker_task_cache_task_id ON worker_task_cache(task_id);
