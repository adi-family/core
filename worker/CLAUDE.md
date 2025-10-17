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

## Task Sources
- Projects can have multiple task sources attached via `file_spaces_task_sources` junction table
- Each task source pulls issues from a specific provider (GitLab, Jira, GitHub)
- Task sources are independent - one project can aggregate issues from multiple providers

### GitLab Issues Task Source
- **Type**: `gitlab_issues`
- **Config**: `{"repo": "owner/repo", "labels": ["DOIT"], "host": "https://gitlab.com"}`
- **Requirements**: GITLAB_TOKEN environment variable
- Monitors repositories with configurable labels (default: "DOIT")

### Jira Task Source
- **Type**: `jira`
- **Config**: `{"project_key": "PROJ", "jql_filter": "status = 'To Do'", "host": "https://jira.example.com"}`
- **Requirements**: Jira credentials in environment or config
- Queries issues via JQL filter

### GitHub Issues Task Source
- **Type**: `github_issues`
- **Config**: `{"repo": "owner/repo", "labels": ["enhancement"], "host": "https://github.com"}`
- **Status**: Not yet implemented (factory.ts:12)

## Database Schema
- **projects** - Project definitions (name, enabled status)
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
