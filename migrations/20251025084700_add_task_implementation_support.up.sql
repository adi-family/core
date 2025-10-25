-- Migration: add_task_implementation_support
-- Created: 2025-10-25 08:47:00

-- Add task_implementation to pipeline_artifacts artifact_type enum
ALTER TABLE pipeline_artifacts DROP CONSTRAINT IF EXISTS pipeline_artifacts_artifact_type_check;
ALTER TABLE pipeline_artifacts ADD CONSTRAINT pipeline_artifacts_artifact_type_check
  CHECK (artifact_type IN ('merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation'));

-- Add implementation tracking columns to tasks table
ALTER TABLE tasks ADD COLUMN ai_implementation_status TEXT DEFAULT 'pending'
  CHECK (ai_implementation_status IN ('pending', 'queued', 'implementing', 'completed', 'failed'));

ALTER TABLE tasks ADD COLUMN ai_implementation_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- Add indexes for implementation queries
CREATE INDEX idx_tasks_ai_implementation_status ON tasks(ai_implementation_status);
CREATE INDEX idx_tasks_ai_implementation_session_id ON tasks(ai_implementation_session_id);
