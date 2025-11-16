# Claude Worker Microservice

A production-ready microservice that consumes tasks from RabbitMQ and executes them using Claude AI.

## Overview

This worker service:
- Consumes tasks from the `worker-tasks` queue
- Executes task evaluation and implementation using Claude
- Sends results back to the `worker-responses` queue
- Scales independently via Docker/Kubernetes
- Runs in your own cloud infrastructure (no GitLab CI dependency)

## Architecture

```
Backend → worker-tasks queue → Claude Worker → worker-responses queue → Worker Dispatcher → Database
```

## Environment Variables

### Required
- `RABBITMQ_URL` - RabbitMQ connection URL

### Optional
- `ANTHROPIC_API_KEY` - **Fallback** API key (used if task doesn't provide one)
- `WORKER_NAME` - Worker instance name (default: `claude-worker`)
- `MAX_CONCURRENCY` - Maximum concurrent tasks (default: `3`)

### API Key Priority

The worker uses API keys in this order:
1. **Task-specific key**: `task.context.aiProvider.anthropic.apiKey` (per-task)
2. **Fallback**: `ANTHROPIC_API_KEY` environment variable (global)

This allows:
- **Multi-tenant**: Different projects use their own API keys
- **Fallback**: Workers can run without per-task keys for testing/development

## Running with Docker Compose

The worker is already configured in `docker-compose.prod.yaml`:

```yaml
micros-claude-worker:
  environment:
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - MAX_CONCURRENCY=${CLAUDE_WORKER_CONCURRENCY:-3}
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Run locally
npm run dev

# Build
npm run build

# Start production
npm start
```

## Current Status

✅ **Fully Implemented:**
- Worker client integration with RabbitMQ
- Task evaluation using Claude Agent SDK
- Task implementation with Claude Code
- Workspace cloning and branch management
- Git operations (commit, push to remote)
- Artifact collection (changed files tracking)
- Usage tracking and cost reporting
- Error handling and graceful shutdown
- Docker containerization
- Automatic temp directory cleanup

## Features

### Evaluation
- Clones workspace repositories for code analysis
- Executes Claude with read-only tools (Read, Glob, Grep)
- Provides structured evaluation with complexity estimation
- Tracks costs and token usage

### Implementation
- Clones workspace repositories
- Creates task-specific branches (`adi/task-{taskId}`)
- Executes Claude with full tools (Bash, Read, Write, Edit, Glob, Grep)
- Collects changed files
- Commits and pushes changes to remote repository
- Returns implementation summary and cost metrics

## Architecture

The worker processes tasks in isolated temporary directories:
1. Creates temp directory for each task
2. Clones workspace repositories
3. Executes Claude Agent SDK
4. Collects results and artifacts
5. Pushes changes to remote (for implementation)
6. Cleans up temp directory

## Related Packages

- `@adi-simple/worker-sdk` - Worker client library
- `@adi-simple/micros-worker-dispatcher` - Consumes worker responses
- `@adi-simple/types` - Shared type definitions
