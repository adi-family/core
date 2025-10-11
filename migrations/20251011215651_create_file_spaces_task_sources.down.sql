-- Rollback: create_file_spaces_task_sources
-- Created: 2025-10-11 21:56:51

-- Remove indexes from tasks table
DROP INDEX IF EXISTS idx_tasks_file_space_id;
DROP INDEX IF EXISTS idx_tasks_task_source_id;

-- Remove columns from tasks table
ALTER TABLE tasks
    DROP COLUMN IF EXISTS file_space_id,
    DROP COLUMN IF EXISTS task_source_id;

-- Drop task_sources table and indexes
DROP INDEX IF EXISTS idx_task_sources_enabled;
DROP INDEX IF EXISTS idx_task_sources_type;
DROP INDEX IF EXISTS idx_task_sources_project_id;
DROP TABLE IF EXISTS task_sources;

-- Drop file_spaces table and indexes
DROP INDEX IF EXISTS idx_file_spaces_enabled;
DROP INDEX IF EXISTS idx_file_spaces_type;
DROP INDEX IF EXISTS idx_file_spaces_project_id;
DROP TABLE IF EXISTS file_spaces;
