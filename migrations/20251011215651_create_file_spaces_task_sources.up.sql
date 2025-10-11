-- Migration: create_file_spaces_task_sources
-- Created: 2025-10-11 21:56:51

-- Create file_spaces table
CREATE TABLE file_spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('gitlab', 'github')),
    config JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_spaces_project_id ON file_spaces(project_id);
CREATE INDEX idx_file_spaces_type ON file_spaces(type);
CREATE INDEX idx_file_spaces_enabled ON file_spaces(enabled);

-- Create task_sources table
CREATE TABLE task_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('gitlab_issues', 'jira', 'github_issues')),
    config JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_sources_project_id ON task_sources(project_id);
CREATE INDEX idx_task_sources_type ON task_sources(type);
CREATE INDEX idx_task_sources_enabled ON task_sources(enabled);

-- Add columns to tasks table
ALTER TABLE tasks
    ADD COLUMN task_source_id UUID REFERENCES task_sources(id) ON DELETE SET NULL,
    ADD COLUMN file_space_id UUID REFERENCES file_spaces(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_task_source_id ON tasks(task_source_id);
CREATE INDEX idx_tasks_file_space_id ON tasks(file_space_id);

-- Migrate existing GitLab projects to file_spaces and task_sources
INSERT INTO file_spaces (project_id, name, type, config, enabled)
SELECT
    id,
    name || ' - Repository',
    'gitlab',
    jsonb_build_object(
        'repo', config->>'repo',
        'host', COALESCE(config->>'host', 'https://gitlab.com')
    ),
    enabled
FROM projects
WHERE type = 'gitlab';

INSERT INTO task_sources (project_id, name, type, config, enabled)
SELECT
    id,
    name || ' - Issues',
    'gitlab_issues',
    jsonb_build_object(
        'repo', config->>'repo',
        'labels', COALESCE(config->'labels', '["DOIT"]'::jsonb),
        'host', COALESCE(config->>'host', 'https://gitlab.com')
    ),
    enabled
FROM projects
WHERE type = 'gitlab';

-- Migrate existing Jira projects to task_sources and file_spaces
INSERT INTO task_sources (project_id, name, type, config, enabled)
SELECT
    id,
    name || ' - Issues',
    'jira',
    jsonb_build_object(
        'project_key', config->>'project_key',
        'jql_filter', config->>'jql_filter',
        'host', config->>'host'
    ),
    enabled
FROM projects
WHERE type = 'jira';

INSERT INTO file_spaces (project_id, name, type, config, enabled)
SELECT
    id,
    name || ' - Repository',
    CASE
        WHEN config->>'repo' LIKE '%github%' THEN 'github'
        ELSE 'gitlab'
    END,
    jsonb_build_object(
        'repo', config->>'repo',
        'host', CASE
            WHEN config->>'repo' LIKE '%github%' THEN 'https://github.com'
            ELSE 'https://gitlab.com'
        END
    ),
    enabled
FROM projects
WHERE type = 'jira' AND config ? 'repo';

-- Update existing tasks with task_source_id and file_space_id
-- For GitLab tasks
UPDATE tasks t
SET
    task_source_id = (
        SELECT ts.id
        FROM task_sources ts
        WHERE ts.project_id = t.project_id
        AND ts.type = 'gitlab_issues'
        LIMIT 1
    ),
    file_space_id = (
        SELECT fs.id
        FROM file_spaces fs
        WHERE fs.project_id = t.project_id
        AND fs.type = 'gitlab'
        LIMIT 1
    )
WHERE t.source_gitlab_issue IS NOT NULL;

-- For Jira tasks
UPDATE tasks t
SET
    task_source_id = (
        SELECT ts.id
        FROM task_sources ts
        WHERE ts.project_id = t.project_id
        AND ts.type = 'jira'
        LIMIT 1
    ),
    file_space_id = (
        SELECT fs.id
        FROM file_spaces fs
        WHERE fs.project_id = t.project_id
        LIMIT 1
    )
WHERE t.source_jira_issue IS NOT NULL;
