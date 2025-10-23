-- Migration: add_ai_provider_configs_to_projects
-- Created: 2025-10-23 03:00:00

-- Add AI provider API key configuration to projects
-- Allows projects to configure Anthropic, OpenAI, and Google/Gemini API keys
-- Each provider references a secret in the secrets table

ALTER TABLE projects ADD COLUMN ai_provider_configs JSONB;

-- Structure:
-- {
--   "anthropic_api_key_secret_id": "uuid-reference-to-secrets-table",
--   "openai_api_key_secret_id": "uuid-reference-to-secrets-table",
--   "google_api_key_secret_id": "uuid-reference-to-secrets-table"
-- }

-- Index for querying projects with AI provider configurations
CREATE INDEX idx_projects_ai_provider_configs ON projects USING gin(ai_provider_configs) WHERE ai_provider_configs IS NOT NULL;

-- Add comment to column
COMMENT ON COLUMN projects.ai_provider_configs IS 'AI provider API key configurations. Each provider key references a secret_id in the secrets table.';
