-- Migration: create_pipeline_executions
-- Created: 2025-10-18 18:54:46

CREATE TABLE pipeline_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    worker_repository_id UUID NOT NULL REFERENCES worker_repositories(id) ON DELETE CASCADE,
    pipeline_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'canceled')),
    last_status_update TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_executions_session_id ON pipeline_executions(session_id);
CREATE INDEX idx_pipeline_executions_worker_repository_id ON pipeline_executions(worker_repository_id);
CREATE INDEX idx_pipeline_executions_status ON pipeline_executions(status);
CREATE INDEX idx_pipeline_executions_last_status_update ON pipeline_executions(last_status_update);
