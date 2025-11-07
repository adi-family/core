-- Migration: create_pipeline_artifacts
-- Created: 2025-10-18 18:54:46

CREATE TABLE pipeline_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_execution_id UUID NOT NULL REFERENCES pipeline_executions(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL CHECK (artifact_type IN ('merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text')),
    reference_url TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pipeline_artifacts_pipeline_execution_id ON pipeline_artifacts(pipeline_execution_id);
CREATE INDEX idx_pipeline_artifacts_artifact_type ON pipeline_artifacts(artifact_type);
