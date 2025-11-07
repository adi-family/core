DROP INDEX IF EXISTS idx_worker_task_cache_project_id;

ALTER TABLE worker_task_cache DROP CONSTRAINT IF EXISTS worker_task_cache_issue_id_project_id_key;

ALTER TABLE worker_task_cache ADD CONSTRAINT worker_task_cache_issue_id_repo_key UNIQUE (issue_id, repo);

CREATE INDEX idx_worker_task_cache_issue_repo ON worker_task_cache(issue_id, repo);

ALTER TABLE worker_task_cache DROP COLUMN IF EXISTS project_id;
