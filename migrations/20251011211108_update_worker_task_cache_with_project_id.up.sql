ALTER TABLE worker_task_cache ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

ALTER TABLE worker_task_cache DROP CONSTRAINT IF EXISTS worker_task_cache_issue_id_repo_key;

ALTER TABLE worker_task_cache ADD CONSTRAINT worker_task_cache_issue_id_project_id_key UNIQUE (issue_id, project_id);

DROP INDEX IF EXISTS idx_worker_task_cache_issue_repo;

CREATE INDEX idx_worker_task_cache_project_id ON worker_task_cache(project_id);
