CREATE TABLE IF NOT EXISTS api_usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Relationships
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    pipeline_execution_id UUID REFERENCES pipeline_executions(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Provider & Model
    provider TEXT NOT NULL,
    model TEXT NOT NULL,

    -- Token counts (for platform pricing)
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_creation_input_tokens INTEGER DEFAULT 0,
    cache_read_input_tokens INTEGER DEFAULT 0,

    -- CI execution time (for platform pricing)
    ci_duration_seconds INTEGER DEFAULT 0,

    -- Classification
    goal TEXT NOT NULL,
    operation_phase TEXT,
    iteration_number INTEGER,

    -- Metadata
    metadata JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_session ON api_usage_metrics(session_id);
CREATE INDEX idx_usage_task ON api_usage_metrics(task_id);
CREATE INDEX idx_usage_provider ON api_usage_metrics(provider);
CREATE INDEX idx_usage_goal ON api_usage_metrics(goal);
CREATE INDEX idx_usage_created ON api_usage_metrics(created_at DESC);
