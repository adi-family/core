-- Rollback: create_task_file_spaces_junction
-- Created: 2025-10-12 17:08:40

-- Add back file_space_id column to tasks table
ALTER TABLE tasks ADD COLUMN file_space_id UUID REFERENCES file_spaces(id) ON DELETE SET NULL;

-- Migrate first file space back to tasks.file_space_id
UPDATE tasks t
SET file_space_id = (
    SELECT file_space_id
    FROM task_file_spaces
    WHERE task_id = t.id
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM task_file_spaces WHERE task_id = t.id
);

CREATE INDEX idx_tasks_file_space_id ON tasks(file_space_id);

-- Drop junction table
DROP TABLE task_file_spaces;

