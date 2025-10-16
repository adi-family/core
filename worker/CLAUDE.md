# worker
gitlab-automation, jira-automation, multi-runner-support, issue-processor, database-tracking

## Overview
- Automated issue processor with multi-runner AI support
- Monitors GitLab/Jira projects and processes issues via AI runners
- **Polling interval**: 10 minutes (600000ms)
- **Workspace isolation**: Clones repositories into APPS_DIR (not committed to git)
- **Branch naming**: `issue/gitlab-{id}` or `issue/jira-{key}`
- **CLI tools**: Uses `glab` for GitLab operations

## Runner Support
- **RUNNER_TYPES**: Comma-separated list of runner names (e.g., "claude", "codex", "gemini")
- **Distribution**: Round-robin assignment of issues across configured runners
- **Built-in runners**: claude (@anthropic-ai/claude-agent-sdk), codex (@openai/codex), gemini (@google/gemini-cli)
- **Extensibility**: Worker is runner-agnostic; createRunner() validates supported types
- Runner selection logged in `sessions.runner` field

## Project Types

### GitLab Project
- **Type**: `gitlab`
- **Config**: `{"repo": "owner/repo", "labels": ["DOIT"], "host": "https://gitlab.com"}`
- **Requirements**: GITLAB_TOKEN environment variable
- Monitors repositories with configurable labels (default: "DOIT")

### Jira Project
- **Type**: `jira`
- **Config**: `{"project_key": "PROJ", "jql_filter": "status = 'To Do'", "host": "https://jira.example.com", "repo": "git@github.com:org/repo.git"}`
- **Requirements**: Jira credentials in environment or config, repo field for cloning
- Queries issues via JQL filter

### Parent Project
- **Type**: `parent`
- **Config**: `{"child_project_ids": ["uuid1", "uuid2"]}`
- Aggregates issues from multiple child projects recursively
- Does not directly process issues

## Database Schema
- **projects** - Project definitions (type, config, enabled status)
- **tasks** - One record per issue (status: processing → completed, links to project_id)
- **sessions** - One record per agent run (links to task via task_id, stores runner type)
- **messages** - All agent messages/chunks (links to session via session_id)
- **worker_task_cache** - Prevents reprocessing (tracks issue_id, project_id, task_id, last_processed_at)
- **source data**: Task records include source_gitlab_issue/source_jira_issue JSONB fields
- **Database client**: Imported from `../db/client` (shared with backend)
- **Worker cache operations**: Imported from `../db/worker-cache` (traffic light pattern)

## Environment Configuration
- **DATABASE_URL** - Postgres connection string (required)
- **APPS_DIR** - Directory for workspace clones (required)
- **RUNNER_TYPES** - Comma-separated list of runner names (default: "claude")
- **GITLAB_TOKEN** - GitLab API token (required for GitLab projects)
- **GITLAB_HOST** - GitLab host URL (default: https://gitlab.com)
- **OPENAI_API_KEY** - Required when using codex runner
- **GOOGLE_API_KEY** - Required when using gemini runner (or use: `npx @google/gemini-cli login`)
