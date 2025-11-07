-- Migration: add_task_evaluation_support (rollback)
-- Created: 2025-10-22 00:15:50

-- Remove indexes
DROP INDEX IF EXISTS idx_tasks_ai_evaluation_session_id;
DROP INDEX IF EXISTS idx_tasks_ai_evaluation_status;

-- Remove evaluation columns from tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS ai_evaluation_session_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS ai_evaluation_status;

-- Restore original artifact_type constraint
ALTER TABLE pipeline_artifacts DROP CONSTRAINT IF EXISTS pipeline_artifacts_artifact_type_check;
ALTER TABLE pipeline_artifacts ADD CONSTRAINT pipeline_artifacts_artifact_type_check
  CHECK (artifact_type IN ('merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text'));
