-- Remove evaluation JSONB columns
DROP INDEX IF EXISTS idx_tasks_simple_eval_complexity;
DROP INDEX IF EXISTS idx_tasks_simple_eval_cross_service;

ALTER TABLE tasks
  DROP COLUMN IF EXISTS ai_evaluation_simple_result,
  DROP COLUMN IF EXISTS ai_evaluation_agentic_result;
