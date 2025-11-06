-- Drop task_file_spaces junction table
-- File spaces are now automatically associated at project level
-- Tasks inherit all file spaces from their project

DROP TABLE IF EXISTS task_file_spaces;
