-- Migration: add_task_evaluation_support
-- Created: 2025-10-22 00:15:50

-- Add task_evaluation to pipeline_artifacts artifact_type enum
ALTER TABLE pipeline_artifacts DROP CONSTRAINT IF EXISTS pipeline_artifacts_artifact_type_check;
ALTER TABLE pipeline_artifacts ADD CONSTRAINT pipeline_artifacts_artifact_type_check
  CHECK (artifact_type IN ('merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation'));

-- Add evaluation tracking columns to tasks table
ALTER TABLE tasks ADD COLUMN ai_evaluation_status TEXT DEFAULT 'pending'
  CHECK (ai_evaluation_status IN ('pending', 'queued', 'evaluating', 'completed', 'failed'));

ALTER TABLE tasks ADD COLUMN ai_evaluation_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL;

-- Add indexes for evaluation queries
CREATE INDEX idx_tasks_ai_evaluation_status ON tasks(ai_evaluation_status);
CREATE INDEX idx_tasks_ai_evaluation_session_id ON tasks(ai_evaluation_session_id);
