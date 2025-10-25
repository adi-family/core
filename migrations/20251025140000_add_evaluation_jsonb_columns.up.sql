-- Add JSONB columns for evaluation data
-- ai_evaluation_simple_result: Quick structured assessment from simple LLM call
-- ai_evaluation_agentic_result: Full agentic evaluation with report and analysis

ALTER TABLE tasks
  ADD COLUMN ai_evaluation_simple_result JSONB,
  ADD COLUMN ai_evaluation_agentic_result JSONB;

-- Indexes for querying evaluation data
CREATE INDEX idx_tasks_simple_eval_complexity
  ON tasks ((ai_evaluation_simple_result->>'complexity'))
  WHERE ai_evaluation_simple_result IS NOT NULL;

CREATE INDEX idx_tasks_simple_eval_cross_service
  ON tasks ((ai_evaluation_simple_result->>'cross_service_communication'))
  WHERE ai_evaluation_simple_result IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN tasks.ai_evaluation_simple_result IS 'Quick structured evaluation: {complexity: 1-100, cross_service_communication: 1-100, ...}';
COMMENT ON COLUMN tasks.ai_evaluation_agentic_result IS 'Full agentic evaluation: {report: string, verdict: string, blockers: array, ...}';
