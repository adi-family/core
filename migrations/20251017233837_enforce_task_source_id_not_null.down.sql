-- Rollback: enforce_task_source_id_not_null
-- Created: 2025-10-17 23:38:37

-- Revert foreign key constraint to SET NULL
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_source_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_source_id_fkey
  FOREIGN KEY (task_source_id) REFERENCES task_sources(id) ON DELETE SET NULL;

-- Make task_source_id nullable again
ALTER TABLE tasks ALTER COLUMN task_source_id DROP NOT NULL;
