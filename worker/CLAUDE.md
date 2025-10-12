# worker
gitlab-automation, jira-automation, multi-runner-support, issue-processor, telegram-notifications, database-tracking

## Overview
- Automated issue processor with multi-runner AI support
- Monitors GitLab/Jira projects, processes issues via AI runners, sends Telegram notifications
- **Polling interval**: 10 minutes (600000ms)
- **Workspace isolation**: Clones repositories into APPS_DIR (not committed to git)
- **Branch naming**: `issue/gitlab-{id}` or `issue/jira-{key}`
- **CLI tools**: Uses `glab` for GitLab operations

## Runner Support
- **RUNNER_TYPES**: Comma-separated list ("claude", "codex", "gemini")
- **Distribution**: Round-robin assignment of issues across runners
- **Claude runner**: @anthropic-ai/claude-agent-sdk with full tool access
- **Codex runner**: @openai/codex CLI with exec mode and full-auto flags
- **Gemini runner**: @google/gemini-cli with YOLO mode for auto-approval
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
- **TELEGRAM_BOT_TOKEN** - Telegram bot token (required)
- **TELEGRAM_CHAT_ID** - Telegram chat ID (required)
- **TELEGRAM_THREAD_ID** - Optional thread ID for notifications
- **RUNNER_TYPES** - Runners to use: "claude", "codex", "gemini", or comma-separated (default: "claude")
- **GITLAB_TOKEN** - GitLab API token (required for GitLab projects)
- **GITLAB_HOST** - GitLab host URL (default: https://gitlab.com)
- **OPENAI_API_KEY** - Required when using codex runner
- **GOOGLE_API_KEY** - Required when using gemini runner (or use: `npx @google/gemini-cli login`)
