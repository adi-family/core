-- Rollback: add_ai_provider_configs_to_projects

DROP INDEX IF EXISTS idx_projects_ai_provider_configs;
ALTER TABLE projects DROP COLUMN IF EXISTS ai_provider_configs;
