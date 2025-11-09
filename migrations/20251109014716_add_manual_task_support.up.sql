-- Add 'manual' type to task_sources type constraint
ALTER TABLE task_sources DROP CONSTRAINT IF EXISTS task_sources_type_check;
ALTER TABLE task_sources ADD CONSTRAINT task_sources_type_check
  CHECK (type IN ('gitlab_issues', 'jira', 'github_issues', 'manual'));

-- Add new fields to tasks table for manual task support
ALTER TABLE tasks
  ADD COLUMN created_by_user_id TEXT,
  ADD COLUMN manual_task_metadata JSONB;

-- Add index for querying tasks by creator
CREATE INDEX idx_tasks_created_by_user_id ON tasks(created_by_user_id);

-- Add index for manual tasks (tasks with manual metadata)
CREATE INDEX idx_tasks_manual_metadata ON tasks(task_source_id) WHERE manual_task_metadata IS NOT NULL;

-- Create a comment to document the schema
COMMENT ON COLUMN tasks.created_by_user_id IS 'User ID who manually created this task. Null for tasks synced from external sources.';
COMMENT ON COLUMN tasks.manual_task_metadata IS 'Additional metadata for manually created tasks. Expected format: {"created_via": "ui" | "api", "custom_properties": {...}}';
