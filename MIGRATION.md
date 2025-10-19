# Migration Guide: Worker Polling → Backend Orchestrator

## What Changed

The worker polling service (`worker/index.ts`) has been **deprecated** and replaced with a Backend Orchestrator that supports multiple trigger sources.

### Before (Worker Polling)
```bash
# Start worker polling service
bun run worker/index.ts

# Worker polls database every 10 minutes
# Worker polls GitLab/Jira APIs for issues
# 10-minute latency before processing
```

### After (Backend Orchestrator)
```bash
# Start backend (includes orchestrator)
bun run backend/index.ts

# Backend receives webhooks → instant processing
# OR backend scheduler polls → same 10-minute interval
# OR manual trigger via API
```

## Migration Steps

### 1. Stop Worker Polling Service
```bash
# If running worker/index.ts, stop it
# It's no longer needed
```

### 2. Update Environment Variables

**Add to `.env`:**
```bash
# Backend configuration
SERVER_PORT=3000
BACKEND_URL=http://localhost:3000

# Choose your trigger method:
# Option A: Enable scheduler (polling fallback)
ENABLE_SCHEDULER=true
SCHEDULER_INTERVAL_MS=600000  # 10 minutes
DEFAULT_RUNNER=claude

# Option B: Webhook secrets (if using webhooks)
GITLAB_WEBHOOK_SECRET=your-secret-token
JIRA_WEBHOOK_SECRET=your-secret-token
```

**Remove or comment out (no longer needed for orchestration):**
```bash
# These are now only used by GitLab CI pipeline scripts
# RUNNER_TYPES=claude,codex,gemini  # ← Not needed for orchestration
```

### 3. Choose Your Trigger Method

#### Option A: Webhooks (Recommended)

**GitLab Webhook Setup:**
1. Go to your GitLab project → Settings → Webhooks
2. URL: `https://your-backend-domain.com/webhooks/gitlab`
3. Secret token: Set to match `GITLAB_WEBHOOK_SECRET`
4. Trigger: ✅ Issues events
5. Save webhook

**Jira Webhook Setup:**
1. Go to Jira → System → WebHooks → Create webhook
2. URL: `https://your-backend-domain.com/webhooks/jira`
3. Events: ✅ Issue created, ✅ Issue updated
4. Save webhook

**Benefits:**
- ✅ Instant processing (no 10-minute delay)
- ✅ No polling overhead
- ✅ Event-driven architecture

#### Option B: Scheduler (Polling)

**Set in `.env`:**
```bash
ENABLE_SCHEDULER=true
SCHEDULER_INTERVAL_MS=600000  # 10 minutes (same as old worker)
DEFAULT_RUNNER=claude
```

**Benefits:**
- ✅ Drop-in replacement for worker polling
- ✅ No external webhook configuration needed
- ✅ Works behind firewalls

#### Option C: Manual Trigger

**Call API endpoint:**
```bash
# Trigger sync for specific task source
curl -X POST http://localhost:3000/task-sources/{task-source-id}/sync

# Or trigger from UI/cron job
```

**Benefits:**
- ✅ Full control over when processing happens
- ✅ Can integrate with existing automation

#### Option D: Hybrid (Recommended for Production)

Use webhooks for instant processing + scheduler as backup:

```bash
# Enable scheduler as fallback
ENABLE_SCHEDULER=true
SCHEDULER_INTERVAL_MS=3600000  # 1 hour (slower backup)

# Configure webhooks for instant processing
GITLAB_WEBHOOK_SECRET=your-secret
```

**Benefits:**
- ✅ Best of both worlds
- ✅ Instant processing via webhooks
- ✅ Scheduler catches any missed events

### 4. Start Backend

```bash
# Development
bun run backend/index.ts

# Production
SERVER_PORT=3000 ENABLE_SCHEDULER=true bun run backend/index.ts
```

## Architecture Comparison

### Old Architecture (Deprecated)
```
┌─────────────────┐
│ Worker Polling  │
│   (index.ts)    │
└────────┬────────┘
         │
         ├─→ Polls Database (every 10min)
         ├─→ Polls GitLab/Jira APIs
         ├─→ Creates Tasks
         └─→ Triggers Pipelines
```

### New Architecture
```
┌──────────────────────────────────────┐
│          Trigger Sources             │
├──────────────────────────────────────┤
│  Webhooks  │  Scheduler  │  Manual   │
│  (instant) │  (10 min)   │  (API)    │
└──────┬───────────┬──────────┬────────┘
       │           │          │
       └───────────┼──────────┘
                   ↓
          ┌────────────────┐
          │    Backend     │
          │  Orchestrator  │
          └────────┬───────┘
                   │
                   ├─→ Fetches Issues
                   ├─→ Creates Tasks
                   ├─→ Triggers GitLab CI
                   └─→ Pipelines Execute AI
```

## What Stays the Same

✅ Database schema unchanged
✅ GitLab CI pipeline scripts unchanged
✅ Task sources configuration unchanged
✅ API endpoints unchanged
✅ Pipeline execution flow unchanged

## What's Different

🔄 **Trigger mechanism**: Webhooks/scheduler instead of worker polling
🔄 **Service to run**: `backend/index.ts` instead of `worker/index.ts`
🔄 **Configuration**: New env vars for scheduler/webhooks
🔄 **Response time**: Instant (webhooks) vs 10-minute delay (polling)

## Troubleshooting

### "No tasks being created"

**Check:**
- Backend is running: `curl http://localhost:3000/projects`
- Webhooks are configured correctly (check webhook delivery logs)
- Or scheduler is enabled: `ENABLE_SCHEDULER=true` in `.env`
- Task sources are enabled in database

### "Webhooks not triggering"

**Check:**
- Webhook URL is publicly accessible
- Webhook secret matches environment variable
- Check backend logs for webhook errors
- Test webhook delivery in GitLab/Jira settings

### "Missing worker/index.ts?"

The worker polling service has been removed. Use `backend/index.ts` instead.

## Questions?

See `discussion-results.md` for detailed architecture documentation.
