-- Migration: encrypt_secrets_values
-- Created: 2025-10-23 03:00:01

-- Add encrypted_value column to secrets table
-- This will eventually replace the plain text 'value' column
-- Migration will be done at application level using crypto-utils.ts

ALTER TABLE secrets ADD COLUMN encrypted_value TEXT;
ALTER TABLE secrets ADD COLUMN encryption_version VARCHAR(50) DEFAULT 'aes-256-gcm-v1';
ALTER TABLE secrets ADD COLUMN is_encrypted BOOLEAN DEFAULT false;

-- Add index for faster lookups of encrypted secrets
CREATE INDEX idx_secrets_is_encrypted ON secrets(is_encrypted);

-- Add comment to columns
COMMENT ON COLUMN secrets.encrypted_value IS 'Encrypted secret value using AES-256-GCM. Format: salt:iv:authTag:encryptedData (all base64)';
COMMENT ON COLUMN secrets.encryption_version IS 'Encryption algorithm version for future key rotation support';
COMMENT ON COLUMN secrets.is_encrypted IS 'Flag indicating if the secret is encrypted (true) or plain text (false)';

-- Note: Migration from 'value' to 'encrypted_value' will be handled by application code
-- Once all secrets are migrated, we can drop the 'value' column in a future migration
