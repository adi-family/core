-- Add auto_evaluate column to task_sources table
-- This controls whether tasks from this source are automatically queued for simple AI evaluation
ALTER TABLE task_sources
ADD COLUMN auto_evaluate BOOLEAN NOT NULL DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN task_sources.auto_evaluate IS
'Controls whether tasks from this source are automatically queued for simple AI evaluation. Set to false to prevent automatic evaluation and reduce AI costs.';
