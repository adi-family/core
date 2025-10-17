-- Migration: drop_projects_type_column
-- Created: 2025-10-17 23:14:38

DROP INDEX IF EXISTS idx_projects_type;
ALTER TABLE projects DROP COLUMN IF EXISTS type;
