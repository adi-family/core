-- Migration: split_evaluation_statuses
-- Created: 2025-11-05
-- Split ai_evaluation_status into separate simple and advanced evaluation statuses
-- Split ai_evaluation_result into separate simple and advanced results

-- Add new status columns for simple and advanced evaluation
ALTER TABLE tasks ADD COLUMN ai_evaluation_simple_status TEXT DEFAULT 'not_started'
  CHECK (ai_evaluation_simple_status IN ('not_started', 'queued', 'evaluating', 'completed', 'failed'));

ALTER TABLE tasks ADD COLUMN ai_evaluation_advanced_status TEXT DEFAULT 'not_started'
  CHECK (ai_evaluation_advanced_status IN ('not_started', 'queued', 'evaluating', 'completed', 'failed'));

-- Add new result columns for simple and advanced evaluation verdicts
ALTER TABLE tasks ADD COLUMN ai_evaluation_simple_verdict TEXT
  CHECK (ai_evaluation_simple_verdict IN ('ready', 'needs_clarification'));

ALTER TABLE tasks ADD COLUMN ai_evaluation_advanced_verdict TEXT
  CHECK (ai_evaluation_advanced_verdict IN ('ready', 'needs_clarification'));

-- Migrate existing data: copy current status and result to new columns
UPDATE tasks SET
  ai_evaluation_simple_status = CASE
    WHEN ai_evaluation_simple_result IS NOT NULL THEN 'completed'
    WHEN ai_evaluation_status = 'pending' THEN 'not_started'
    ELSE ai_evaluation_status
  END,
  ai_evaluation_advanced_status = CASE
    WHEN ai_evaluation_agentic_result IS NOT NULL THEN 'completed'
    WHEN ai_evaluation_simple_result IS NOT NULL AND ai_evaluation_status = 'failed' THEN 'failed'
    WHEN ai_evaluation_status = 'pending' THEN 'not_started'
    ELSE ai_evaluation_status
  END,
  ai_evaluation_simple_verdict = CASE
    WHEN ai_evaluation_simple_result IS NOT NULL THEN ai_evaluation_result
    ELSE NULL
  END,
  ai_evaluation_advanced_verdict = CASE
    WHEN ai_evaluation_agentic_result IS NOT NULL THEN ai_evaluation_result
    ELSE NULL
  END;

-- Add indexes for performance
CREATE INDEX idx_tasks_ai_evaluation_simple_status ON tasks(ai_evaluation_simple_status);
CREATE INDEX idx_tasks_ai_evaluation_advanced_status ON tasks(ai_evaluation_advanced_status);
CREATE INDEX idx_tasks_ai_evaluation_simple_verdict ON tasks(ai_evaluation_simple_verdict) WHERE ai_evaluation_simple_verdict IS NOT NULL;
CREATE INDEX idx_tasks_ai_evaluation_advanced_verdict ON tasks(ai_evaluation_advanced_verdict) WHERE ai_evaluation_advanced_verdict IS NOT NULL;

-- Drop old columns (no longer needed)
DROP INDEX IF EXISTS idx_tasks_ai_evaluation_status;
DROP INDEX IF EXISTS idx_tasks_evaluation_result;
ALTER TABLE tasks DROP COLUMN ai_evaluation_status;
ALTER TABLE tasks DROP COLUMN ai_evaluation_result;
