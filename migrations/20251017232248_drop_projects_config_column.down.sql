-- Rollback: drop_projects_config_column
-- Created: 2025-10-17 23:22:48

ALTER TABLE projects ADD COLUMN config JSONB;
