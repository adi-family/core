-- Migration: update_worker_task_cache_with_project_id
-- Created: 2025-10-11 21:11:08

-- Add project_id column
ALTER TABLE worker_task_cache ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Drop old unique constraint
ALTER TABLE worker_task_cache DROP CONSTRAINT IF EXISTS worker_task_cache_issue_id_repo_key;

-- Add new unique constraint
ALTER TABLE worker_task_cache ADD CONSTRAINT worker_task_cache_issue_id_project_id_key UNIQUE (issue_id, project_id);

-- Drop old index (if exists)
DROP INDEX IF EXISTS idx_worker_task_cache_issue_repo;

-- Add new index
CREATE INDEX idx_worker_task_cache_project_id ON worker_task_cache(project_id);
