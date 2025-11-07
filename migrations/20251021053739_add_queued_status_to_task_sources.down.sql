-- Rollback: add_queued_status_to_task_sources
-- Created: 2025-10-21 05:37:39

-- Remove 'queued' status from sync_status check constraint
ALTER TABLE task_sources
DROP CONSTRAINT IF EXISTS task_sources_sync_status_check;

ALTER TABLE task_sources
ADD CONSTRAINT task_sources_sync_status_check
CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed'));

-- Revert comment
COMMENT ON COLUMN task_sources.sync_status IS 'Current sync status: pending (never synced), syncing (in progress), completed (success), failed (error)';
