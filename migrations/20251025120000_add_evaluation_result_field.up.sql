-- Add evaluation result field to separate workflow state from outcome
-- ai_evaluation_status = workflow state (pending, queued, evaluating, completed, failed)
-- ai_evaluation_result = evaluation outcome (ready, needs_clarification)

ALTER TABLE tasks
  ADD COLUMN ai_evaluation_result TEXT
  CHECK (ai_evaluation_result IN ('ready', 'needs_clarification'));

-- Index for filtering by result
CREATE INDEX idx_tasks_evaluation_result
  ON tasks(ai_evaluation_result)
  WHERE ai_evaluation_result IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN tasks.ai_evaluation_result IS 'The outcome of AI evaluation: ready (ready for implementation) or needs_clarification (requires more info)';
