-- Migration: drop_projects_config_column
-- Created: 2025-10-17 23:22:48

ALTER TABLE projects DROP COLUMN IF EXISTS config;
