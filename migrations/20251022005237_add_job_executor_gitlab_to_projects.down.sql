-- Migration: add_job_executor_gitlab_to_projects (rollback)
-- Created: 2025-10-22 00:52:37

-- Remove index
DROP INDEX IF EXISTS idx_projects_job_executor_gitlab;

-- Remove column
ALTER TABLE projects DROP COLUMN IF EXISTS job_executor_gitlab;
