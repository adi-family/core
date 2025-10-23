-- Rollback: rename_source_to_source_gitlab_in_worker_repositories
-- Created: 2025-10-23 02:37:34

ALTER TABLE worker_repositories RENAME COLUMN source_gitlab TO source;

