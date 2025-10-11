gitlab-automation, jira-automation, multi-runner-support, issue-processor, telegram-notifications, database-tracking, project-based-architecture

- Automated issue processor with multiple AI runner support and project-based architecture
- Supports three runners: Claude Agent SDK, OpenAI Codex CLI, Google Gemini CLI
- Round-robin distribution of issues across available runners
- Projects managed in database with three types: gitlab, jira, parent
- GitLab projects monitor repositories with configurable labels (default: "DOIT")
- Jira projects query issues via JQL filter
- Parent projects aggregate issues from multiple child projects
- Creates dedicated branches for each issue (issue/gitlab-{id} or issue/jira-{key})
- Clones repositories into APPS_DIR for workspace isolation
- Sends Telegram notifications on issue completion
- Polling interval: 10 minutes (600000ms)
- Uses glab CLI for GitLab operations (issues, merge requests)
- All workspace clones persist in APPS_DIR (not committed to git)

## Database Integration
- Stores all work in Postgres database via shared connection
- `projects` table stores project definitions (type, config, enabled status)
- Creates `tasks` record for each issue (status: processing → completed, links to project_id)
- Creates `sessions` record for each agent run (links to task via task_id)
- Stores all agent messages/chunks in `messages` table (links to session via session_id)
- Uses `worker_task_cache` table to prevent reprocessing (tracks issue_id, project_id, task_id, last_processed_at)
- Task record includes source_gitlab_issue/source_jira_issue JSONB field with full issue data
- Database connection via DATABASE_URL from root .env
- Shared schema with backend (projects/tasks/sessions/messages tables)

## Multi-Runner Architecture
- RUNNER_TYPES - Comma-separated list of runners to use (e.g., "claude,codex,gemini")
- Each issue is automatically assigned to next runner in round-robin fashion
- Claude runner: Uses @anthropic-ai/claude-agent-sdk with full tool access
- Codex runner: Uses @openai/codex CLI with exec mode and full-auto flags
- Gemini runner: Uses @google/gemini-cli with YOLO mode for auto-approval
- Runner selection logged per session in database sessions.runner field

## Project Types and Configuration

### GitLab Project
- Type: `gitlab`
- Config: `{"repo": "owner/repo", "labels": ["DOIT"], "host": "https://gitlab.com"}`
- Requires GITLAB_TOKEN environment variable
- Uses glab CLI for issue operations

### Jira Project
- Type: `jira`
- Config: `{"project_key": "PROJ", "jql_filter": "status = 'To Do'", "host": "https://jira.example.com", "repo": "git@github.com:org/repo.git"}`
- Requires Jira credentials in environment or config
- repo field required for workspace cloning

### Parent Project
- Type: `parent`
- Config: `{"child_project_ids": ["uuid1", "uuid2"]}`
- Aggregates issues from multiple child projects recursively
- Does not directly process issues

## Environment Variables
- DATABASE_URL - Postgres connection string (required)
- GITLAB_TOKEN - GitLab API token (required for GitLab projects)
- GITLAB_HOST - GitLab host URL (default: https://gitlab.com)
- TELEGRAM_BOT_TOKEN - Telegram bot token (required)
- TELEGRAM_CHAT_ID - Telegram chat ID (required)
- TELEGRAM_THREAD_ID - Optional thread ID for notifications
- RUNNER_TYPES - Runners to use: "claude", "codex", "gemini", or comma-separated (default: "claude")
- OPENAI_API_KEY - Required when using codex runner
- GOOGLE_API_KEY - Required when using gemini runner (or use: npx @google/gemini-cli login)
- APPS_DIR - Directory for workspace clones (required)
