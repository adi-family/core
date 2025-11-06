-- Migration: update_pending_to_not_started (rollback)
-- Revert 'not_started' back to 'pending'

UPDATE tasks
SET
  ai_evaluation_simple_status = 'pending'
WHERE ai_evaluation_simple_status = 'not_started';

UPDATE tasks
SET
  ai_evaluation_advanced_status = 'pending'
WHERE ai_evaluation_advanced_status = 'not_started';
