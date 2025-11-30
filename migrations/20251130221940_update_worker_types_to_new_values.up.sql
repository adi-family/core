-- Update worker types: rename 'custom-microservice' to 'adi-runner' and add 'sdk' type
-- New types: 'gitlab-ci', 'adi-runner', 'sdk'

-- First, update existing values from 'custom-microservice' to 'adi-runner'
UPDATE projects SET default_worker_type = 'adi-runner' WHERE default_worker_type = 'custom-microservice';
UPDATE sessions SET worker_type_override = 'adi-runner' WHERE worker_type_override = 'custom-microservice';
UPDATE sessions SET executed_by_worker_type = 'adi-runner' WHERE executed_by_worker_type = 'custom-microservice';

-- Drop old CHECK constraints and add new ones with updated values
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_default_worker_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_default_worker_type_check
  CHECK (default_worker_type IN ('gitlab-ci', 'adi-runner', 'sdk'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_worker_type_override_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_worker_type_override_check
  CHECK (worker_type_override IN ('gitlab-ci', 'adi-runner', 'sdk'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_executed_by_worker_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_executed_by_worker_type_check
  CHECK (executed_by_worker_type IN ('gitlab-ci', 'adi-runner', 'sdk'));

-- Update default value for projects
ALTER TABLE projects ALTER COLUMN default_worker_type SET DEFAULT 'adi-runner';

-- Create table for SDK worker registrations
CREATE TABLE sdk_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  api_key_hash TEXT NOT NULL,
  last_heartbeat_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
  capabilities JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sdk_workers_project_id ON sdk_workers(project_id);
CREATE INDEX idx_sdk_workers_status ON sdk_workers(status);
CREATE INDEX idx_sdk_workers_api_key_hash ON sdk_workers(api_key_hash);

-- Create table for SDK worker task assignments
CREATE TABLE sdk_worker_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES sdk_workers(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'timeout')),
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  result JSONB,
  error JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sdk_worker_tasks_worker_id ON sdk_worker_tasks(worker_id);
CREATE INDEX idx_sdk_worker_tasks_session_id ON sdk_worker_tasks(session_id);
CREATE INDEX idx_sdk_worker_tasks_status ON sdk_worker_tasks(status);

-- Create table for SDK worker messages (for streaming communication)
CREATE TABLE sdk_worker_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES sdk_worker_tasks(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('worker_to_server', 'server_to_worker')),
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sdk_worker_messages_task_id ON sdk_worker_messages(task_id);
CREATE INDEX idx_sdk_worker_messages_created_at ON sdk_worker_messages(created_at);
