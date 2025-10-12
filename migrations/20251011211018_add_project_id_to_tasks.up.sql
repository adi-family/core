ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
