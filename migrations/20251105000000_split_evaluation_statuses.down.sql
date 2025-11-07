-- Migration: split_evaluation_statuses (rollback)
-- Restore old columns and drop split evaluation status/result columns

-- Restore old columns
ALTER TABLE tasks ADD COLUMN ai_evaluation_status TEXT DEFAULT 'not_started'
  CHECK (ai_evaluation_status IN ('not_started', 'queued', 'evaluating', 'completed', 'failed'));

ALTER TABLE tasks ADD COLUMN ai_evaluation_result TEXT
  CHECK (ai_evaluation_result IN ('ready', 'needs_clarification'));

-- Copy data back (best effort - take most severe status)
UPDATE tasks SET
  ai_evaluation_status = CASE
    WHEN ai_evaluation_simple_status = 'failed' OR ai_evaluation_advanced_status = 'failed' THEN 'failed'
    WHEN ai_evaluation_simple_status = 'completed' AND ai_evaluation_advanced_status = 'completed' THEN 'completed'
    WHEN ai_evaluation_simple_status = 'evaluating' OR ai_evaluation_advanced_status = 'evaluating' THEN 'evaluating'
    WHEN ai_evaluation_simple_status = 'queued' OR ai_evaluation_advanced_status = 'queued' THEN 'queued'
    ELSE 'not_started'
  END,
  ai_evaluation_result = COALESCE(ai_evaluation_advanced_verdict, ai_evaluation_simple_verdict);

-- Restore old indexes
CREATE INDEX idx_tasks_ai_evaluation_status ON tasks(ai_evaluation_status);
CREATE INDEX idx_tasks_evaluation_result ON tasks(ai_evaluation_result) WHERE ai_evaluation_result IS NOT NULL;

-- Drop new columns
DROP INDEX IF EXISTS idx_tasks_ai_evaluation_simple_status;
DROP INDEX IF EXISTS idx_tasks_ai_evaluation_advanced_status;
DROP INDEX IF EXISTS idx_tasks_ai_evaluation_simple_verdict;
DROP INDEX IF EXISTS idx_tasks_ai_evaluation_advanced_verdict;

ALTER TABLE tasks DROP COLUMN IF EXISTS ai_evaluation_simple_status;
ALTER TABLE tasks DROP COLUMN IF EXISTS ai_evaluation_advanced_status;
ALTER TABLE tasks DROP COLUMN IF EXISTS ai_evaluation_simple_verdict;
ALTER TABLE tasks DROP COLUMN IF EXISTS ai_evaluation_advanced_verdict;
