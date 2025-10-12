DROP INDEX IF EXISTS idx_tasks_project_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS project_id;
