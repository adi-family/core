-- Rollback custom worker support

ALTER TABLE sessions
DROP COLUMN IF EXISTS executed_by_worker_type;

ALTER TABLE sessions
DROP COLUMN IF EXISTS worker_type_override;

ALTER TABLE projects
DROP COLUMN IF EXISTS allow_worker_override;

ALTER TABLE projects
DROP COLUMN IF EXISTS default_worker_type;
