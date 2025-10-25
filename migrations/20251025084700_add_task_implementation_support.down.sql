-- Migration rollback: add_task_implementation_support
-- Created: 2025-10-25 08:47:00

-- Remove indexes
DROP INDEX IF EXISTS idx_tasks_ai_implementation_session_id;
DROP INDEX IF EXISTS idx_tasks_ai_implementation_status;

-- Remove implementation columns
ALTER TABLE tasks DROP COLUMN IF EXISTS ai_implementation_session_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS ai_implementation_status;

-- Restore previous artifact_type constraint
ALTER TABLE pipeline_artifacts DROP CONSTRAINT IF EXISTS pipeline_artifacts_artifact_type_check;
ALTER TABLE pipeline_artifacts ADD CONSTRAINT pipeline_artifacts_artifact_type_check
  CHECK (artifact_type IN ('merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation'));
