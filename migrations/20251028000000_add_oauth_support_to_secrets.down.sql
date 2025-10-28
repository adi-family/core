-- Rollback OAuth support from secrets table

ALTER TABLE secrets DROP COLUMN IF EXISTS scopes;
ALTER TABLE secrets DROP COLUMN IF EXISTS expires_at;
ALTER TABLE secrets DROP COLUMN IF EXISTS refresh_token;
ALTER TABLE secrets DROP COLUMN IF EXISTS token_type;
ALTER TABLE secrets DROP COLUMN IF EXISTS oauth_provider;
