-- Rollback: encrypt_secrets_values

DROP INDEX IF EXISTS idx_secrets_is_encrypted;
ALTER TABLE secrets DROP COLUMN IF EXISTS is_encrypted;
ALTER TABLE secrets DROP COLUMN IF EXISTS encryption_version;
ALTER TABLE secrets DROP COLUMN IF EXISTS encrypted_value;
