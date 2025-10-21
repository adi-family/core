-- Migration: add_task_source_sync_tracking (rollback)
-- Created: 2025-10-21 02:29:41

-- Drop sync state table
DROP TABLE IF EXISTS task_source_sync_state;

-- Remove sync tracking columns from task_sources
ALTER TABLE task_sources
DROP COLUMN IF EXISTS last_synced_at,
DROP COLUMN IF EXISTS sync_status;

-- Drop indexes (will be dropped automatically with columns, but explicit for clarity)
DROP INDEX IF EXISTS idx_task_sources_sync_status;
DROP INDEX IF EXISTS idx_task_sources_last_synced_at;
