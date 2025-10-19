-- Rollback: create_secrets_table
-- Created: 2025-10-20 00:06:40

DROP INDEX IF EXISTS idx_secrets_project_id;
DROP TABLE IF EXISTS secrets;
