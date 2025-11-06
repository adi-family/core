-- Migration: update_pending_to_not_started
-- Created: 2025-11-05
-- Update existing 'pending' values to 'not_started' in ai_evaluation_simple_status and ai_evaluation_advanced_status

UPDATE tasks
SET
  ai_evaluation_simple_status = 'not_started'
WHERE ai_evaluation_simple_status = 'pending';

UPDATE tasks
SET
  ai_evaluation_advanced_status = 'not_started'
WHERE ai_evaluation_advanced_status = 'pending';
