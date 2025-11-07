ALTER TABLE projects ADD COLUMN last_synced_at TIMESTAMP;

COMMENT ON COLUMN projects.last_synced_at IS 'Timestamp of the last successful workspace sync for this project';
