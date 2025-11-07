-- Remove evaluation result field

DROP INDEX IF EXISTS idx_tasks_evaluation_result;

ALTER TABLE tasks DROP COLUMN IF EXISTS ai_evaluation_result;
