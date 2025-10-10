-- Rollback: add_tasks_sessions_messages
-- Created: 2025-10-10 22:39:46

-- Drop tables in reverse order
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS tasks;
