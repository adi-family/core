gitlab-automation, claude-agent-sdk, issue-processor, telegram-notifications, database-tracking

- Automated GitLab issue processor using Claude Agent SDK
- Monitors repositories with "DOIT" label for open issues
- Creates dedicated branches for each issue (issue/gitlab-{id})
- Clones repositories into .apps/ directory for workspace isolation
- Sends Telegram notifications on issue completion
- Configured repos: nakit-yok/backend, nakit-yok/frontend
- Polling interval: 10 minutes (600000ms)
- Uses glab CLI for GitLab operations (issues, merge requests)
- Agent has access to: Bash(npm/glab/git), Read, Write, Edit, Glob tools
- All workspace clones persist in worker/.apps/ (not committed to git)

## Database Integration
- Stores all work in Postgres database via shared connection
- Creates `tasks` record for each GitLab issue (status: processing → completed)
- Creates `sessions` record for each agent run (links to task via task_id)
- Stores all agent messages/chunks in `messages` table (links to session via session_id)
- Uses `worker_task_cache` table to prevent reprocessing (tracks issue_id, repo, task_id, last_processed_at)
- Task record includes source_gitlab_issue JSONB field with full issue data
- Database connection via DATABASE_URL from root .env
- Shared schema with backend (tasks/sessions/messages tables)

## Environment Variables
- DATABASE_URL - Postgres connection string (required)
- GITLAB_TOKEN - GitLab API token (required)
- GITLAB_HOST - GitLab host URL (default: https://gitlab.com)
- TELEGRAM_BOT_TOKEN - Telegram bot token (required)
- TELEGRAM_CHAT_ID - Telegram chat ID (required)
- TELEGRAM_THREAD_ID - Optional thread ID for notifications
