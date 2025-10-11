-- Rollback: update_worker_task_cache_with_project_id
-- Created: 2025-10-11 21:11:08

-- Drop new index
DROP INDEX IF EXISTS idx_worker_task_cache_project_id;

-- Drop new unique constraint
ALTER TABLE worker_task_cache DROP CONSTRAINT IF EXISTS worker_task_cache_issue_id_project_id_key;

-- Restore old unique constraint
ALTER TABLE worker_task_cache ADD CONSTRAINT worker_task_cache_issue_id_repo_key UNIQUE (issue_id, repo);

-- Restore old index
CREATE INDEX idx_worker_task_cache_issue_repo ON worker_task_cache(issue_id, repo);

-- Drop project_id column
ALTER TABLE worker_task_cache DROP COLUMN IF EXISTS project_id;
