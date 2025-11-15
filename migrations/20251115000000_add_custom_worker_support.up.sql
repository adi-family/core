-- Add custom worker support to projects and sessions tables

-- Update projects table to support worker type configuration
ALTER TABLE projects
ADD COLUMN default_worker_type TEXT DEFAULT 'custom-microservice'
CHECK (default_worker_type IN ('gitlab-ci', 'custom-microservice'));

ALTER TABLE projects
ADD COLUMN allow_worker_override BOOLEAN DEFAULT true;

-- Update sessions table to track worker type usage
ALTER TABLE sessions
ADD COLUMN worker_type_override TEXT
CHECK (worker_type_override IN ('gitlab-ci', 'custom-microservice'));

ALTER TABLE sessions
ADD COLUMN executed_by_worker_type TEXT
CHECK (executed_by_worker_type IN ('gitlab-ci', 'custom-microservice'));
