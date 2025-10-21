-- Migration: add_job_executor_gitlab_to_projects
-- Created: 2025-10-22 00:52:37

-- Add job executor gitlab configuration to projects
-- Allows projects to use custom GitLab instance for pipeline execution
-- Falls back to system default if not set

ALTER TABLE projects ADD COLUMN job_executor_gitlab JSONB;

-- Structure:
-- {
--   "host": "https://gitlab.custom.com",
--   "access_token_secret_id": "uuid-reference-to-secrets-table",
--   "verified_at": "2025-10-22T00:00:00Z",
--   "user": "bot-user-display-name"
-- }

-- Index for querying projects with custom executors
CREATE INDEX idx_projects_job_executor_gitlab ON projects((job_executor_gitlab->>'host')) WHERE job_executor_gitlab IS NOT NULL;
