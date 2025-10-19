# Deployment Guide

Backend Orchestrator deployment with webhook/scheduler support.

## Architecture

**Single Service:** Backend handles API + orchestration + webhooks + optional scheduler

**Execution:** GitLab CI pipelines run AI agents (not local services)

## Prerequisites

- Docker and Docker Compose
- PostgreSQL database
- GitLab account with API access
- Bun runtime (for local development)

## Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd adi-simple
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5436/postgres?sslmode=disable

# Backend
SERVER_PORT=3000
BACKEND_URL=http://localhost:3000

# Choose orchestration method:
# Option A: Enable scheduler (periodic polling)
ENABLE_SCHEDULER=true
SCHEDULER_INTERVAL_MS=600000  # 10 minutes
DEFAULT_RUNNER=claude

# Option B: Webhooks (configure in GitLab/Jira)
GITLAB_WEBHOOK_SECRET=your-secret-token
JIRA_WEBHOOK_SECRET=your-secret-token

# Security (REQUIRED for pipeline mode)
ENCRYPTION_KEY=$(openssl rand -hex 32)
API_TOKEN=$(openssl rand -hex 32)

# GitLab Configuration
GITLAB_HOST=https://gitlab.com
GITLAB_TOKEN=your-gitlab-token
GITLAB_USER=your-username

# Pipeline Mode
USE_PIPELINE_EXECUTION=true

# Agent API Keys (for CI/CD variables)
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
GOOGLE_API_KEY=your-key
```

### 3. Start Services

**Development:**
```bash
# Start database
docker compose up -d postgres migrations

# Start backend (includes orchestrator)
bun run dev
```

**Production:**
```bash
docker compose -f docker-compose.prod.yaml up -d
```

## Orchestration Setup

Choose one or more trigger methods:

### Option 1: Webhooks (Recommended)

#### GitLab Webhook
1. Go to GitLab project → Settings → Webhooks
2. URL: `https://your-backend.com/webhooks/gitlab`
3. Secret token: Match `GITLAB_WEBHOOK_SECRET`
4. Trigger: ✅ Issues events
5. Save webhook

#### Jira Webhook
1. Go to Jira → System → WebHooks
2. URL: `https://your-backend.com/webhooks/jira`
3. Events: ✅ Issue created, ✅ Issue updated
4. Save webhook

**Benefits:** Instant processing, no polling overhead

### Option 2: Scheduler

Set in `.env`:
```bash
ENABLE_SCHEDULER=true
SCHEDULER_INTERVAL_MS=600000  # 10 minutes
DEFAULT_RUNNER=claude
```

**Benefits:** Works behind firewalls, no external config

### Option 3: Hybrid (Production Recommended)

```bash
# Webhooks for instant processing
GITLAB_WEBHOOK_SECRET=your-secret

# Scheduler as backup (slower interval)
ENABLE_SCHEDULER=true
SCHEDULER_INTERVAL_MS=3600000  # 1 hour backup
```

**Benefits:** Best reliability - instant + fallback

## Database Setup

Migrations run automatically on startup. Manual run:

```bash
cd migrations
./create_migration.sh migration_name
```

## GitLab CI/CD Setup

### 1. Create Worker Repository

```bash
bun run backend/index.ts
# Then via API or UI, create worker repository
```

Or use CLI tool:
```bash
DATABASE_URL=<url> GITLAB_TOKEN=<token> \
  bun run worker/utils/create-worker-repo.ts
```

### 2. Set CI/CD Variables

In GitLab worker repository → Settings → CI/CD → Variables:

```bash
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
GOOGLE_API_KEY=your-key
API_TOKEN=<same as backend .env>
BACKEND_URL=https://your-backend.com
```

### 3. Verify Pipeline

Push to worker repo triggers pipeline. Check:
- Pipeline status in GitLab
- Backend logs for webhook/scheduler activity
- Tasks created in database

## Production Deployment

### Docker Compose

```bash
# Configure production .env
cp .env.example .env
# Edit .env with production values

# Deploy
docker compose -f docker-compose.prod.yaml up -d

# View logs
docker compose -f docker-compose.prod.yaml logs -f backend

# Scale backend if needed
docker compose -f docker-compose.prod.yaml up -d --scale backend=3
```

### Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection
- `SERVER_PORT` - Backend port (default: 3000)
- `ENCRYPTION_KEY` - 32+ character key
- `API_TOKEN` - Pipeline authentication

**Optional:**
- `ENABLE_SCHEDULER` - Enable polling (true/false)
- `SCHEDULER_INTERVAL_MS` - Poll interval (ms)
- `DEFAULT_RUNNER` - claude/codex/gemini
- `GITLAB_WEBHOOK_SECRET` - Webhook verification
- `BACKEND_URL` - Self-call URL

## Monitoring

### Health Checks

```bash
# Backend API
curl http://localhost:3000/projects

# Database connection
psql $DATABASE_URL -c "SELECT 1"
```

### Logs

```bash
# Backend logs
docker logs -f adi-simple-backend

# Database logs
docker logs -f adi-simple-postgres
```

### Metrics

Monitor:
- Tasks created per day
- Pipeline success rate
- Webhook delivery success
- Scheduler execution times

## Troubleshooting

### No tasks being created

**Check:**
- Backend is running and accessible
- Webhooks configured with correct URL and secret
- Or scheduler enabled: `ENABLE_SCHEDULER=true`
- Task sources enabled in database
- Backend logs for errors

### Webhooks not working

**Check:**
- Webhook URL publicly accessible
- Secret matches environment variable
- GitLab/Jira webhook delivery logs
- Backend logs for webhook requests

### Pipeline failures

**Check:**
- CI/CD variables set correctly
- `API_TOKEN` matches backend
- `BACKEND_URL` points to backend
- Worker repository has templates
- Agent API keys valid

## Security

### Production Checklist

- [ ] Strong `ENCRYPTION_KEY` (64+ characters)
- [ ] Strong `API_TOKEN` (64+ characters)
- [ ] Webhook secrets configured
- [ ] HTTPS enabled for backend
- [ ] Database uses SSL
- [ ] GitLab tokens scoped minimally
- [ ] Environment variables not committed to git

### Rotating Keys

**ENCRYPTION_KEY:**
⚠️ **DO NOT ROTATE** after encrypting data - encrypted tokens will become inaccessible

**API_TOKEN:**
1. Generate new token
2. Update backend `.env`
3. Update GitLab CI/CD variables
4. Restart backend
5. Verify pipelines work

## Backup & Recovery

### Database Backup

```bash
# Backup
docker exec adi-simple-postgres \
  pg_dump -U postgres postgres > backup.sql

# Restore
cat backup.sql | docker exec -i adi-simple-postgres \
  psql -U postgres postgres
```

### Configuration Backup

```bash
# Backup environment (remove secrets before committing!)
cp .env .env.backup
```

## Migration from Worker Polling

See [MIGRATION.md](../MIGRATION.md) for complete migration guide.

**Quick steps:**
1. Stop old worker service
2. Update `.env` with backend vars
3. Configure webhooks or enable scheduler
4. Start backend
5. Verify tasks being created

## References

- [Migration Guide](../MIGRATION.md)
- [Architecture Documentation](../discussion-results.md)
- [Environment Variables](./ENVIRONMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
