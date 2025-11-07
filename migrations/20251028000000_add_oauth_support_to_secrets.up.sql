-- Add OAuth support to secrets table
-- This allows storing OAuth tokens alongside API tokens

ALTER TABLE secrets ADD COLUMN IF NOT EXISTS oauth_provider TEXT;
ALTER TABLE secrets ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'api' CHECK (token_type IN ('api', 'oauth'));
ALTER TABLE secrets ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE secrets ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE secrets ADD COLUMN IF NOT EXISTS scopes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN secrets.oauth_provider IS 'OAuth provider name (jira, github, gitlab) for OAuth tokens';
COMMENT ON COLUMN secrets.token_type IS 'Type of token: api for API tokens, oauth for OAuth tokens';
COMMENT ON COLUMN secrets.refresh_token IS 'OAuth refresh token for automatic token renewal';
COMMENT ON COLUMN secrets.expires_at IS 'Expiration timestamp for OAuth access tokens';
COMMENT ON COLUMN secrets.scopes IS 'OAuth scopes granted to the token (space-separated)';
