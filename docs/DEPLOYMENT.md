# Deployment Guide

This document provides step-by-step instructions for deploying the ADI worker system with GitLab pipeline integration.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (managed by Docker Compose)
- GitLab account with API access
- Bun runtime installed (for local development)
- glab CLI installed (for GitLab operations)

## 1. Environment Setup

### 1.1 Clone the Repository

```bash
git clone <repository-url>
cd adi-simple
```

### 1.2 Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set the following variables:

```bash
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5436/postgres?sslmode=disable

# Worker Configuration
APPS_DIR=.apps
RUNNER_TYPES=claude,codex,gemini

# Security (REQUIRED)
ENCRYPTION_KEY=your-secure-encryption-key-min-32-characters-long
API_TOKEN=your-secure-api-token-for-pipeline-authentication

# GitLab Configuration
GITLAB_HOST=https://gitlab.the-ihor.com
GITLAB_TOKEN=your-gitlab-personal-access-token

# Agent API Keys
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key  # if using codex
GOOGLE_API_KEY=your-google-api-key  # if using gemini

# Pipeline Execution Mode
USE_PIPELINE_EXECUTION=true

# Pipeline Monitoring (optional)
PIPELINE_STATUS_TIMEOUT_MINUTES=30
PIPELINE_POLL_INTERVAL_MS=600000
```

**Important Security Notes:**
- `ENCRYPTION_KEY`: Generate a secure random string (minimum 32 characters)
- `API_TOKEN`: Generate a secure random token for API authentication
- Never commit `.env` files to version control

### 1.3 Generate Secure Keys

```bash
# Generate ENCRYPTION_KEY (64 characters recommended)
openssl rand -hex 32

# Generate API_TOKEN
openssl rand -hex 32
```

## 2. Database Setup

### 2.1 Start PostgreSQL

```bash
cd migrations
docker compose up -d postgres
```

### 2.2 Run Migrations

```bash
docker compose up migrations
```

Verify migrations:

```bash
docker compose run --rm migrations version
```

You should see version 3 (or latest) with all migrations applied.

## 3. GitLab Worker Repository Setup

### 3.1 Create Worker Repository

For each project that needs automated issue processing, create a worker repository:

```typescript
import { CIRepositoryManager } from './worker/ci-repository-manager'
import { createWorkerRepository } from './db/worker-repositories'
import { sql } from './db/client'

const manager = new CIRepositoryManager()

// Create GitLab worker repository
const source = await manager.createWorkerRepository({
  projectName: 'my-project',
  sourceType: 'gitlab',
  host: process.env.GITLAB_HOST!,
  accessToken: process.env.GITLAB_TOKEN!,
})

// Upload CI files
await manager.uploadCIFiles({
  source,
  version: '2025-10-18-01',
})

// Save to database
await createWorkerRepository(sql, {
  project_id: '<your-project-id>',
  source: source,
  current_version: '2025-10-18-01',
})
```

### 3.2 Configure GitLab CI/CD Variables

In the created worker repository, configure the following CI/CD variables (Settings → CI/CD → Variables):

**Required Variables:**
- `API_BASE_URL`: Your backend API URL (e.g., `http://your-server:3000`)
- `API_TOKEN`: The same token you set in your `.env` file
- `ANTHROPIC_API_KEY`: Your Claude API key
- `DATABASE_URL`: Database connection string (if workers need direct DB access)

**Optional Variables (for other runners):**
- `OPENAI_API_KEY`: For Codex runner
- `GOOGLE_API_KEY`: For Gemini runner

**Important:** Mark all API keys as "Masked" and "Protected" in GitLab.

## 4. Backend Deployment

### 4.1 Local Development

```bash
# Install dependencies
bun install

# Run backend
cd backend
bun run index.ts
```

Backend will start on port 3000 by default.

### 4.2 Production Deployment (Docker)

```bash
# Build backend image
docker build -t adi-backend -f backend/Dockerfile .

# Run backend container
docker run -d \
  --name adi-backend \
  -p 3000:3000 \
  --env-file .env \
  adi-backend
```

Or use docker-compose:

```bash
docker compose -f docker-compose.prod.yaml up -d backend
```

## 5. Worker Deployment

### 5.1 Local Development

```bash
cd worker
bun run index.ts
```

### 5.2 Production Deployment (Docker)

```bash
# Build worker image
docker build -t adi-worker -f worker/Dockerfile .

# Run worker container
docker run -d \
  --name adi-worker \
  --env-file .env \
  -v $(pwd)/.apps:/app/.apps \
  adi-worker
```

Or use docker-compose:

```bash
docker compose -f docker-compose.prod.yaml up -d worker
```

## 6. Verification

### 6.1 Check Backend Health

```bash
curl http://localhost:3000/projects
```

Should return a list of projects.

### 6.2 Check Database

```bash
psql $DATABASE_URL -c "\dt"
```

Should show all tables including:
- projects
- tasks
- sessions
- messages
- worker_repositories
- pipeline_executions
- pipeline_artifacts

### 6.3 Check Worker Logs

```bash
docker logs -f adi-worker
```

Should show polling activity every 10 minutes.

### 6.4 Test Pipeline Execution

1. Create a test project and task source in the database
2. Create an issue in your configured GitLab repository with the "DOIT" label
3. Wait for the worker to poll (or restart it)
4. Check that:
   - Task is created in database
   - Session is created
   - Pipeline is triggered in the worker repository
   - Pipeline execution record exists
   - Pipeline runs successfully
   - Merge request is created
   - Artifact is uploaded

## 7. Monitoring

### 7.1 Pipeline Status

Check pipeline executions:

```bash
curl http://localhost:3000/pipeline-executions
```

### 7.2 Pipeline Artifacts

Check created artifacts (MRs):

```bash
curl http://localhost:3000/pipeline-artifacts
```

### 7.3 GitLab Pipelines

Visit your worker repository's Pipelines page to see running pipelines.

## 8. Scaling

### 8.1 Multiple Workers

You can run multiple worker instances for load distribution:

```bash
# Worker 1 - handles Claude tasks
docker run -d --name adi-worker-1 \
  --env-file .env \
  -e RUNNER_TYPES=claude \
  adi-worker

# Worker 2 - handles Codex tasks
docker run -d --name adi-worker-2 \
  --env-file .env \
  -e RUNNER_TYPES=codex \
  adi-worker
```

### 8.2 Backend Scaling

Run multiple backend instances behind a load balancer:

```bash
docker run -d --name adi-backend-1 -p 3001:3000 --env-file .env adi-backend
docker run -d --name adi-backend-2 -p 3002:3000 --env-file .env adi-backend
```

Use nginx or HAProxy for load balancing.

## 9. Backup and Recovery

### 9.1 Database Backup

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### 9.2 Database Restore

```bash
psql $DATABASE_URL < backup-20251018.sql
```

### 9.3 Migration Rollback

```bash
cd migrations
docker compose run --rm migrations down 1
```

## 10. Upgrading

### 10.1 Update Code

```bash
git pull origin main
bun install
```

### 10.2 Run New Migrations

```bash
cd migrations
docker compose up migrations
```

### 10.3 Rebuild and Restart Services

```bash
docker compose -f docker-compose.prod.yaml up -d --build
```

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## Security Checklist

- [ ] `.env` file is not committed to version control
- [ ] `ENCRYPTION_KEY` is strong and unique
- [ ] `API_TOKEN` is strong and unique
- [ ] GitLab CI/CD variables are masked and protected
- [ ] Database is not exposed to public internet
- [ ] Backend API has authentication enabled
- [ ] TLS/SSL is configured for production
- [ ] Regular backups are configured
- [ ] Logs are monitored for security events
