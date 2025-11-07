-- Migration rollback: change_task_status_defaults_to_null
-- Created: 2025-10-28 12:00:00

-- Revert ai_evaluation_status default back to 'pending'
ALTER TABLE tasks ALTER COLUMN ai_evaluation_status DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN ai_evaluation_status SET DEFAULT 'pending';

-- Revert ai_implementation_status default back to 'pending'
ALTER TABLE tasks ALTER COLUMN ai_implementation_status DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN ai_implementation_status SET DEFAULT 'pending';

-- Restore NULL values back to 'pending'
UPDATE tasks SET ai_evaluation_status = 'pending' WHERE ai_evaluation_status IS NULL;
UPDATE tasks SET ai_implementation_status = 'pending' WHERE ai_implementation_status IS NULL;
