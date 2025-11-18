-- Migration: add_task_keys
-- Created: 2025-11-18 06:48:47
-- Add JIRA-like task keys to projects and tasks

-- Add key column to projects table (e.g., "ENG", "PROD")
ALTER TABLE projects
ADD COLUMN key TEXT UNIQUE;

-- Add task_key column to tasks table (e.g., "ENG-1", "ENG-2")
ALTER TABLE tasks
ADD COLUMN task_key TEXT UNIQUE;

-- Add task_sequence to projects to track next task number
ALTER TABLE projects
ADD COLUMN task_sequence INTEGER DEFAULT 0 NOT NULL;

-- Create function to generate next task key for a project
CREATE OR REPLACE FUNCTION generate_task_key(p_project_id UUID)
RETURNS TEXT AS $$
DECLARE
  project_key TEXT;
  next_seq INTEGER;
  new_task_key TEXT;
BEGIN
  -- Get project key and increment sequence atomically
  UPDATE projects
  SET task_sequence = task_sequence + 1
  WHERE id = p_project_id
  RETURNING key, task_sequence INTO project_key, next_seq;

  -- If project has no key, return NULL
  IF project_key IS NULL THEN
    RETURN NULL;
  END IF;

  -- Generate task key in format: PROJECT-123
  new_task_key := project_key || '-' || next_seq;

  RETURN new_task_key;
END;
$$ LANGUAGE plpgsql;

-- Generate keys for existing projects based on their names
-- Format: Take first 3-4 uppercase letters from project name
UPDATE projects
SET key = UPPER(
  CASE
    WHEN LENGTH(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g')) >= 4
    THEN SUBSTRING(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g') FROM 1 FOR 4)
    WHEN LENGTH(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g')) >= 3
    THEN SUBSTRING(REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g') FROM 1 FOR 3)
    ELSE REGEXP_REPLACE(name, '[^A-Za-z]', '', 'g')
  END
)
WHERE key IS NULL;

-- If there are duplicate keys after auto-generation, append numbers
DO $$
DECLARE
  duplicate_key RECORD;
  counter INTEGER;
BEGIN
  FOR duplicate_key IN
    SELECT key, COUNT(*) as cnt
    FROM projects
    WHERE key IS NOT NULL
    GROUP BY key
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    FOR duplicate_key IN
      SELECT id, key FROM projects WHERE key = duplicate_key.key ORDER BY created_at
    LOOP
      IF counter > 1 THEN
        UPDATE projects SET key = key || counter WHERE id = duplicate_key.id;
      END IF;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Generate task keys for existing tasks using CTE
WITH numbered_tasks AS (
  SELECT
    t.id,
    p.key || '-' || ROW_NUMBER() OVER (PARTITION BY t.project_id ORDER BY t.created_at) AS new_task_key
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  WHERE p.key IS NOT NULL
    AND t.task_key IS NULL
)
UPDATE tasks
SET task_key = numbered_tasks.new_task_key
FROM numbered_tasks
WHERE tasks.id = numbered_tasks.id;

-- Update task_sequence for each project to match highest task number
UPDATE projects p
SET task_sequence = COALESCE(
  (
    SELECT MAX(
      CAST(
        SUBSTRING(t.task_key FROM LENGTH(p.key) + 2)
        AS INTEGER
      )
    )
    FROM tasks t
    WHERE t.project_id = p.id
      AND t.task_key LIKE p.key || '-%'
  ),
  0
);

-- Add index for task_key lookups
CREATE INDEX idx_tasks_task_key ON tasks(task_key);

-- Add index for project key lookups
CREATE INDEX idx_projects_key ON projects(key);

-- Create trigger function to auto-generate task_key on insert
CREATE OR REPLACE FUNCTION auto_generate_task_key()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate task_key if it's not already set and project_id is present
  IF NEW.task_key IS NULL AND NEW.project_id IS NOT NULL THEN
    NEW.task_key := generate_task_key(NEW.project_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires before insert on tasks
CREATE TRIGGER trigger_auto_generate_task_key
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_task_key();
