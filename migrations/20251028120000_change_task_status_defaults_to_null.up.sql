-- Migration: change_task_status_defaults_to_null
-- Created: 2025-10-28 12:00:00

-- Change ai_evaluation_status default from 'pending' to NULL
ALTER TABLE tasks ALTER COLUMN ai_evaluation_status DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN ai_evaluation_status SET DEFAULT NULL;

-- Change ai_implementation_status default from 'pending' to NULL
ALTER TABLE tasks ALTER COLUMN ai_implementation_status DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN ai_implementation_status SET DEFAULT NULL;

-- Update existing 'pending' values to NULL to clean up historical data
-- This assumes that 'pending' was being used as "not started" rather than "queued"
UPDATE tasks SET ai_evaluation_status = NULL WHERE ai_evaluation_status = 'pending' AND ai_evaluation_session_id IS NULL;
UPDATE tasks SET ai_implementation_status = NULL WHERE ai_implementation_status = 'pending' AND ai_implementation_session_id IS NULL;
