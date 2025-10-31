-- Migration: create_api_keys
-- Created: 2025-10-31 00:00:00

-- API keys for pipeline authentication and API access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{"pipeline_execute": true, "read_project": true}'::jsonb,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX idx_api_keys_revoked_at ON api_keys(revoked_at);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Partial index for active (non-revoked) keys
CREATE INDEX idx_api_keys_active ON api_keys(project_id, key_hash) WHERE revoked_at IS NULL;
