-- Migration: enforce_task_source_id_not_null
-- Created: 2025-10-17 23:38:37

-- Delete tasks without task_source_id (old tasks created before task sources)
DELETE FROM tasks WHERE task_source_id IS NULL;

-- Make task_source_id NOT NULL
ALTER TABLE tasks ALTER COLUMN task_source_id SET NOT NULL;

-- Update foreign key constraint to CASCADE on delete
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_source_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_source_id_fkey
  FOREIGN KEY (task_source_id) REFERENCES task_sources(id) ON DELETE CASCADE;
