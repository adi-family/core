CREATE TABLE task_file_spaces (
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_space_id UUID NOT NULL REFERENCES file_spaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, file_space_id)
);

CREATE INDEX idx_task_file_spaces_task_id ON task_file_spaces(task_id);
CREATE INDEX idx_task_file_spaces_file_space_id ON task_file_spaces(file_space_id);

INSERT INTO task_file_spaces (task_id, file_space_id)
SELECT id, file_space_id
FROM tasks
WHERE file_space_id IS NOT NULL;

ALTER TABLE tasks DROP COLUMN file_space_id;
