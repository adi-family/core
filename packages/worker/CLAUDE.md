# worker
gitlab-ci-scripts, pipeline-templates, task-sources, deprecated-polling-service

## ⚠️ DEPRECATED: Worker Polling Service
**The `worker/index.ts` polling service has been replaced by Backend Orchestrator**

The backend now handles all orchestration via:
- **Webhooks** - GitLab/Jira issue events trigger immediate processing
- **Scheduler** - Optional periodic polling (set `ENABLE_SCHEDULER=true`)
- **Manual sync** - API endpoint `POST /task-sources/:id/sync`

**To migrate:**
1. Stop running `worker/index.ts`
2. Use `backend/index.ts` instead
3. Configure webhooks or enable scheduler
4. See `discussion-results.md` for details

## Current Purpose
This directory now contains utilities used by GitLab CI pipelines:
- **templates/** - GitLab CI worker scripts (run AI agents in pipelines)
- **task-sources/** - Issue fetching logic (used by backend orchestrator)
- **pipeline-executor.ts** - Pipeline triggering (moved to backend)
- **gitlab.ts, issue.ts** - GitLab utilities
- **crypto-utils.ts** - Encryption utilities (moved to backend)

## Task Sources (Used by Backend)
Task source implementations moved to `backend/task-sources/`:

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
- **Status**: Not yet implemented

## GitLab CI Pipeline Scripts
- **templates/*/worker-scripts/** - Scripts executed in GitLab CI pipelines
- Runs AI agents (Claude, Codex, Gemini)
- POSTs results back to backend API
- Uses backend API client for state management
