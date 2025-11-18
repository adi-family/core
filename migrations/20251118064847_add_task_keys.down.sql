-- Rollback: add_task_keys
-- Created: 2025-11-18 06:48:47
-- Remove JIRA-like task keys from projects and tasks

-- Drop trigger
DROP TRIGGER IF EXISTS trigger_auto_generate_task_key ON tasks;

-- Drop trigger function
DROP FUNCTION IF EXISTS auto_generate_task_key();

-- Drop indexes
DROP INDEX IF EXISTS idx_tasks_task_key;
DROP INDEX IF EXISTS idx_projects_key;

-- Drop key generation function
DROP FUNCTION IF EXISTS generate_task_key(UUID);

-- Drop columns from tasks table
ALTER TABLE tasks
DROP COLUMN IF EXISTS task_key;

-- Drop columns from projects table
ALTER TABLE projects
DROP COLUMN IF EXISTS task_sequence;

ALTER TABLE projects
DROP COLUMN IF EXISTS key;
