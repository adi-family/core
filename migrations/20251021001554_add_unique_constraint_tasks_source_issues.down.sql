-- Rollback: add_unique_constraint_tasks_source_issues
-- Created: 2025-10-21 00:15:54

-- Drop unique indexes for source issues
DROP INDEX IF EXISTS idx_tasks_gitlab_issue_unique;
DROP INDEX IF EXISTS idx_tasks_github_issue_unique;
DROP INDEX IF EXISTS idx_tasks_jira_issue_unique;
