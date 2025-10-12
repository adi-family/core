ALTER TABLE tasks ADD COLUMN file_space_id UUID REFERENCES file_spaces(id) ON DELETE SET NULL;

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

DROP TABLE task_file_spaces;
