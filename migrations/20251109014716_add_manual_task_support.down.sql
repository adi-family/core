-- Migration: add_manual_task_support (DOWN)
-- Revert changes from add_manual_task_support

-- Remove comments
COMMENT ON COLUMN tasks.manual_task_metadata IS NULL;
COMMENT ON COLUMN tasks.created_by_user_id IS NULL;

-- Drop indexes
DROP INDEX IF EXISTS idx_tasks_manual_metadata;
DROP INDEX IF EXISTS idx_tasks_created_by_user_id;

-- Remove new columns
ALTER TABLE tasks
  DROP COLUMN IF EXISTS manual_task_metadata,
  DROP COLUMN IF EXISTS created_by_user_id;

-- Revert task_sources type constraint to original values
ALTER TABLE task_sources DROP CONSTRAINT IF EXISTS task_sources_type_check;
ALTER TABLE task_sources ADD CONSTRAINT task_sources_type_check
  CHECK (type IN ('gitlab_issues', 'jira', 'github_issues'));
