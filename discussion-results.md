# Architecture Decision: Event-Driven Backend Orchestration

## Problem
Current architecture has unnecessary polling overhead:
- Worker service polls database every 10 minutes
- Worker polls GitLab/Jira APIs for new issues
- 10-minute latency before issues are processed
- Database coordination overhead for "finding work"
- Worker is essentially a job scheduler triggering another job scheduler (GitLab CI)

## Solution: Backend as Orchestrator

### Architecture
```
Trigger Sources → Backend (orchestrator) → GitLab CI Pipeline (execution)
                       ↓                            ↓
                   Database (state)          Backend API (results)
```

### Backend Responsibilities
- Receive events from multiple trigger sources
- Decide if/when to spawn work
- Create task in database
- Trigger GitLab CI pipeline with task context
- Receive results from pipeline
- Store state/results

### GitLab CI Responsibilities
- Execute AI agent with provided task context
- Run the actual work
- POST results back to Backend API

### Trigger Sources
1. **Webhooks** - GitLab/Jira issue events → Backend receives → Spawn pipeline
2. **Cron jobs** - Backend scheduled task runs → Check for work → Spawn pipelines
3. **Manual triggers** - UI button / API call → Backend → Spawn pipeline
4. **Any event source** - Message queue, database trigger, external API, etc.

## Benefits
✅ Event-driven, not polling - Instant reaction when issues change
✅ No worker polling service - Eliminate entire worker/index.ts polling loop
✅ GitLab webhooks are free - Built-in feature, no infrastructure needed
✅ Backend as orchestrator - Single point of coordination
✅ Pipeline does real work - Same GitLab CI execution, just triggered reactively
✅ Flexible - Support webhooks, cron, manual, or any trigger source

## What Gets Eliminated
- ❌ Entire worker/index.ts polling loop
- ❌ Worker service polling database every 10 minutes
- ❌ Worker polling GitLab/Jira APIs
- ❌ Database coordination for "finding work"

## What Gets Kept
- ✅ GitLab CI execution (pipeline-executor, pipeline scripts)
- ✅ Backend API (already exists)
- ✅ Database for state/results
- ✅ Worker utilities (pipeline-executor.ts becomes backend module)

## Implementation Status: ✅ COMPLETE

### Changes Made

#### 1. Backend Orchestrator Service
- **File**: `backend/services/orchestrator.ts`
- **Functions**:
  - `processTaskSource()` - Fetches issues from a task source and triggers pipelines
  - `processProjectTaskSources()` - Processes all task sources for a project
  - `processAllProjects()` - Processes all enabled projects
- **Features**:
  - Uses worker cache (traffic light pattern) to prevent duplicate processing
  - Creates tasks and sessions in database
  - Triggers GitLab CI pipelines when `USE_PIPELINE_EXECUTION=true`
  - Handles errors gracefully and continues processing

#### 2. Webhook Endpoints
- **File**: `backend/handlers/webhooks.ts`
- **Routes**:
  - `POST /webhooks/gitlab` - Receives GitLab issue webhooks
  - `POST /webhooks/jira` - Receives Jira issue webhooks
  - `POST /webhooks/github` - Receives GitHub issue webhooks
- **Features**:
  - Webhook secret validation (optional)
  - Automatic task source matching based on repo/project
  - Triggers orchestrator to process issues immediately
  - Returns detailed results

#### 3. Scheduler Service
- **File**: `backend/services/scheduler.ts`
- **Configuration**:
  - `ENABLE_SCHEDULER=true` - Enable periodic polling (optional)
  - `SCHEDULER_INTERVAL_MS=600000` - Poll interval (default: 10 minutes)
  - `DEFAULT_RUNNER=claude` - Default AI runner to use
- **Features**:
  - Runs on backend startup if enabled
  - Graceful shutdown handling
  - Processes all enabled projects on each interval

#### 4. Task Source Sync Endpoint
- **Updated**: `backend/handlers/task-sources.ts`
- **Route**: `POST /task-sources/:id/sync`
- **Function**: Now actually triggers orchestrator to fetch and process issues

#### 5. Moved Components to Backend
- `backend/pipeline-executor.ts` - Pipeline triggering logic
- `backend/crypto-utils.ts` - Encryption/decryption utilities
- `backend/gitlab-api-client.ts` - GitLab API client
- `backend/api-client.ts` - Backend self-client factory
- `backend/task-sources/` - Task source implementations (GitLab, Jira)

#### 6. Updated Configuration
- **File**: `.env.example`
- **New Variables**:
  - `SERVER_PORT` - Backend server port
  - `BACKEND_URL` - Backend URL for self-calls
  - `ENABLE_SCHEDULER` - Enable periodic polling
  - `SCHEDULER_INTERVAL_MS` - Polling interval
  - `DEFAULT_RUNNER` - Default AI runner
  - `GITLAB_WEBHOOK_SECRET` - GitLab webhook secret
  - `JIRA_WEBHOOK_SECRET` - Jira webhook secret
  - `GITHUB_WEBHOOK_SECRET` - GitHub webhook secret

### Usage

#### Option 1: Webhooks (Recommended)
Configure webhooks in GitLab/Jira to point to:
- GitLab: `http://your-backend:3000/webhooks/gitlab`
- Jira: `http://your-backend:3000/webhooks/jira`

Issues are processed immediately when created/updated.

#### Option 2: Scheduler (Polling)
Set `ENABLE_SCHEDULER=true` in `.env`

Backend will poll all task sources every 10 minutes (configurable).

#### Option 3: Manual Trigger
Call sync endpoint manually:
```bash
POST /task-sources/:id/sync
```

#### Option 4: Mix and Match
Use webhooks for real-time + scheduler as backup for missed events.

### Migration Path

#### Current (Worker Polling):
1. Worker polls database every 10 minutes
2. Worker polls GitLab/Jira APIs
3. Worker triggers pipelines or runs AI locally

#### New (Backend Orchestrator):
1. Backend receives webhook → Immediate processing
2. OR Backend scheduler polls → Same 10-minute interval
3. Backend triggers GitLab CI pipelines
4. GitLab CI runs AI agent and POSTs results back

#### To Migrate:
1. Update `.env` with new backend variables
2. Configure webhooks in GitLab/Jira (optional)
3. Set `ENABLE_SCHEDULER=true` if you want polling fallback
4. Start backend: `bun run backend/index.ts`
5. **Worker polling service has been deprecated** (see MIGRATION.md)

## Cleanup Complete ✅

### Worker Polling Service Removed
- ❌ `worker/index.ts` deleted permanently
- ✅ Worker directory contains utilities for GitLab CI pipelines only

### Documentation Updated
- ✅ `worker/CLAUDE.md` - Marked as deprecated, explains new purpose
- ✅ `backend/CLAUDE.md` - Added orchestrator, webhooks, scheduler docs
- ✅ `.env.example` - Added backend vars, marked worker vars as deprecated
- ✅ `MIGRATION.md` - Complete migration guide created
- ✅ `discussion-results.md` - Full architecture documentation

### Service Architecture
**Single service to run:** `backend/index.ts`
- Handles REST API
- Orchestrates issue processing
- Receives webhooks
- Optional scheduler
- Triggers GitLab CI pipelines

**No longer needed:** `worker/index.ts` (polling service)

### Deployment Options
1. **Webhooks only** - Real-time event processing
2. **Scheduler only** - 10-minute polling (drop-in worker replacement)
3. **Hybrid** - Webhooks + scheduler backup (recommended for production)
4. **Manual** - API-triggered sync on demand
