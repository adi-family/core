-- Rollback: Remove auto_evaluate column from task_sources table
ALTER TABLE task_sources DROP COLUMN auto_evaluate;
