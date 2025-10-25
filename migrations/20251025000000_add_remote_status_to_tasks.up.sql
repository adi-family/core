-- Migration: add_remote_status_to_tasks
-- Created: 2025-10-25 00:00:00

-- Add remote_status column to track GitLab/GitHub issue state
ALTER TABLE tasks ADD COLUMN remote_status TEXT DEFAULT 'opened'
  CHECK (remote_status IN ('opened', 'closed'));

-- Add index for status queries
CREATE INDEX idx_tasks_remote_status ON tasks(remote_status);
