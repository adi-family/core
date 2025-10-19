-- Migration: create_worker_repositories
-- Created: 2025-10-18 18:54:45

CREATE TABLE worker_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_gitlab JSONB NOT NULL,
    current_version TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id)
);

CREATE INDEX idx_worker_repositories_project_id ON worker_repositories(project_id);
CREATE INDEX idx_worker_repositories_source_type ON worker_repositories((source_gitlab->>'type'));
