-- Migration: add_remote_status_to_tasks (rollback)
-- Created: 2025-10-25 00:00:00

-- Drop remote_status index
DROP INDEX IF EXISTS idx_tasks_remote_status;

-- Drop remote_status column
ALTER TABLE tasks DROP COLUMN IF EXISTS remote_status;
