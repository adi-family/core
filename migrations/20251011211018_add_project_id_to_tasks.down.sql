-- Rollback: add_project_id_to_tasks
-- Created: 2025-10-11 21:10:18

DROP INDEX IF EXISTS idx_tasks_project_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS project_id;
