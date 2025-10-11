-- Migration: add_project_id_to_tasks
-- Created: 2025-10-11 21:10:18

ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
