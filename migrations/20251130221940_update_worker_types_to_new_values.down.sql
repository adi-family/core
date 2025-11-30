-- Revert worker types back to original values

-- Drop SDK worker tables
DROP TABLE IF EXISTS sdk_worker_messages;
DROP TABLE IF EXISTS sdk_worker_tasks;
DROP TABLE IF EXISTS sdk_workers;

-- Revert data back to 'custom-microservice'
UPDATE projects SET default_worker_type = 'custom-microservice' WHERE default_worker_type = 'adi-runner';
UPDATE sessions SET worker_type_override = 'custom-microservice' WHERE worker_type_override = 'adi-runner';
UPDATE sessions SET executed_by_worker_type = 'custom-microservice' WHERE executed_by_worker_type = 'adi-runner';

-- Remove SDK type entries (would be orphaned)
UPDATE projects SET default_worker_type = 'custom-microservice' WHERE default_worker_type = 'sdk';
UPDATE sessions SET worker_type_override = NULL WHERE worker_type_override = 'sdk';
UPDATE sessions SET executed_by_worker_type = NULL WHERE executed_by_worker_type = 'sdk';

-- Restore original CHECK constraints
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_default_worker_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_default_worker_type_check
  CHECK (default_worker_type IN ('gitlab-ci', 'custom-microservice'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_worker_type_override_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_worker_type_override_check
  CHECK (worker_type_override IN ('gitlab-ci', 'custom-microservice'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_executed_by_worker_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_executed_by_worker_type_check
  CHECK (executed_by_worker_type IN ('gitlab-ci', 'custom-microservice'));

-- Restore default value
ALTER TABLE projects ALTER COLUMN default_worker_type SET DEFAULT 'custom-microservice';
