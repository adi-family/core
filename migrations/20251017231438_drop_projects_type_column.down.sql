-- Rollback: drop_projects_type_column
-- Created: 2025-10-17 23:14:38

ALTER TABLE projects ADD COLUMN type TEXT;
CREATE INDEX idx_projects_type ON projects(type);
