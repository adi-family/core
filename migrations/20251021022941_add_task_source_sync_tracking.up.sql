-- Migration: add_task_source_sync_tracking
-- Created: 2025-10-21 02:29:41

-- Add sync tracking columns to task_sources
ALTER TABLE task_sources
ADD COLUMN last_synced_at TIMESTAMP,
ADD COLUMN sync_status TEXT DEFAULT 'pending'
  CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed'));

-- Create index for querying by sync status
CREATE INDEX idx_task_sources_sync_status ON task_sources(sync_status);
CREATE INDEX idx_task_sources_last_synced_at ON task_sources(last_synced_at);

-- Create sync state tracking table
-- Tracks each issue we've seen from each task source
CREATE TABLE task_source_sync_state (
  task_source_id UUID NOT NULL REFERENCES task_sources(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL,
  issue_updated_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_source_id, issue_id)
);

-- Indexes for sync state queries
CREATE INDEX idx_sync_state_task_source_id ON task_source_sync_state(task_source_id);
CREATE INDEX idx_sync_state_last_seen_at ON task_source_sync_state(last_seen_at);
CREATE INDEX idx_sync_state_issue_updated_at ON task_source_sync_state(issue_updated_at);

-- Comment explaining the purpose
COMMENT ON TABLE task_source_sync_state IS 'Tracks which issues we have seen from each task source to detect updates and deletions';
COMMENT ON COLUMN task_sources.last_synced_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN task_sources.sync_status IS 'Current sync status: pending (never synced), syncing (in progress), completed (success), failed (error)';
