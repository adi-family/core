-- Migration: add_unique_constraint_tasks_source_issues
-- Created: 2025-10-21 00:15:54

-- Add unique constraint to prevent duplicate tasks from same source issue
-- Uses partial unique indexes for each source type

-- GitLab issues: unique on task_source_id + gitlab issue id
CREATE UNIQUE INDEX idx_tasks_gitlab_issue_unique
ON tasks (task_source_id, (source_gitlab_issue->>'id'))
WHERE source_gitlab_issue IS NOT NULL;

-- GitHub issues: unique on task_source_id + github issue id
CREATE UNIQUE INDEX idx_tasks_github_issue_unique
ON tasks (task_source_id, (source_github_issue->>'id'))
WHERE source_github_issue IS NOT NULL;

-- Jira issues: unique on task_source_id + jira issue id
CREATE UNIQUE INDEX idx_tasks_jira_issue_unique
ON tasks (task_source_id, (source_jira_issue->>'id'))
WHERE source_jira_issue IS NOT NULL;
