-- Recreate task_file_spaces junction table for rollback
-- This allows reverting to task-specific file space associations

CREATE TABLE task_file_spaces (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_space_id UUID NOT NULL REFERENCES file_spaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, file_space_id)
);

CREATE INDEX idx_task_file_spaces_task_id ON task_file_spaces(task_id);
CREATE INDEX idx_task_file_spaces_file_space_id ON task_file_spaces(file_space_id);

-- Populate with project-level associations
INSERT INTO task_file_spaces (task_id, file_space_id)
SELECT t.id, fs.id
FROM tasks t
INNER JOIN file_spaces fs ON fs.project_id = t.project_id
WHERE t.project_id IS NOT NULL;
