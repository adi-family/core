# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the ADI worker system.

## Table of Contents

- [Database Issues](#database-issues)
- [Worker Issues](#worker-issues)
- [Pipeline Execution Issues](#pipeline-execution-issues)
- [Authentication Issues](#authentication-issues)
- [GitLab Integration Issues](#gitlab-integration-issues)
- [Agent Execution Issues](#agent-execution-issues)
- [Performance Issues](#performance-issues)
- [Debugging Tips](#debugging-tips)

---

## Database Issues

### Cannot Connect to Database

**Symptoms:**
```
Error: Connection refused
ECONNREFUSED 127.0.0.1:5436
```

**Solutions:**

1. Check if PostgreSQL is running:
```bash
docker compose ps postgres
```

2. Verify DATABASE_URL:
```bash
echo $DATABASE_URL
```

3. Test connection:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

4. Check if port 5436 is available:
```bash
lsof -i :5436
```

5. Restart PostgreSQL:
```bash
docker compose restart postgres
```

### Migration Failed

**Symptoms:**
```
Dirty database version X. Fix and force version.
```

**Solutions:**

1. Check current version:
```bash
cd migrations
docker compose run --rm migrations version
```

2. Force to correct version:
```bash
docker compose run --rm migrations force <version>
```

3. Re-run migrations:
```bash
docker compose up migrations
```

### Table Does Not Exist

**Symptoms:**
```
relation "pipeline_executions" does not exist
```

**Solutions:**

1. Check if migrations ran:
```bash
psql $DATABASE_URL -c "\dt"
```

2. Run migrations:
```bash
cd migrations
docker compose up migrations
```

3. Check migration version:
```bash
docker compose run --rm migrations version
```

---

## Worker Issues

### Worker Not Processing Tasks

**Symptoms:**
- No tasks being created
- Worker logs show no activity

**Solutions:**

1. Check worker logs:
```bash
docker logs -f adi-worker
```

2. Verify polling interval hasn't timed out

3. Check task sources are configured:
```bash
curl http://localhost:3000/task-sources
```

4. Verify projects are enabled:
```bash
curl http://localhost:3000/projects
```

5. Check GitLab issues have correct labels (default: "DOIT")

6. Restart worker:
```bash
docker compose restart worker
```

### Worker Crashes on Startup

**Symptoms:**
```
Error: APPS_DIR is required
```

**Solutions:**

1. Check environment variables:
```bash
env | grep -E '(DATABASE_URL|APPS_DIR|RUNNER_TYPES)'
```

2. Verify .env file exists and is loaded:
```bash
cat .env
```

3. Create APPS_DIR:
```bash
mkdir -p .apps
```

4. Check file permissions:
```bash
ls -la .apps
```

---

## Pipeline Execution Issues

### Pipeline Not Triggered

**Symptoms:**
- Session created but no pipeline execution record
- Worker logs show "Worker repository not found"

**Solutions:**

1. Check worker repository exists:
```bash
curl http://localhost:3000/worker-repositories
```

2. Create worker repository if missing:
```typescript
// See DEPLOYMENT.md section 3.1
```

3. Verify USE_PIPELINE_EXECUTION is enabled:
```bash
echo $USE_PIPELINE_EXECUTION
```

4. Check worker logs for errors:
```bash
docker logs -f adi-worker | grep ERROR
```

### Pipeline Fails Immediately

**Symptoms:**
- Pipeline execution status shows "failed"
- GitLab pipeline shows red status

**Solutions:**

1. Check GitLab pipeline logs:
   - Go to worker repository → CI/CD → Pipelines
   - Click on failed pipeline
   - Read job logs

2. Common causes:
   - Missing CI/CD variables in GitLab
   - Invalid API_TOKEN
   - Network connectivity issues
   - Missing docker image

3. Verify CI/CD variables:
   - Go to worker repository → Settings → CI/CD → Variables
   - Check: API_BASE_URL, API_TOKEN, ANTHROPIC_API_KEY

4. Test API connectivity from GitLab runner:
```yaml
# Add to .gitlab-ci.yml temporarily
test_connectivity:
  script:
    - curl -v $API_BASE_URL/projects
```

### Pipeline Stuck in "pending" Status

**Symptoms:**
- Pipeline execution never completes
- GitLab shows pipeline running but no progress

**Solutions:**

1. Check pipeline monitor is running:
```bash
# Worker logs should show periodic status checks
docker logs adi-worker | grep "Updating status"
```

2. Check timeout settings:
```bash
echo $PIPELINE_STATUS_TIMEOUT_MINUTES
```

3. Manually update pipeline status:
```bash
curl -X PATCH http://localhost:3000/pipeline-executions/<execution-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"status": "failed"}'
```

4. Check GitLab runner is available:
   - Go to worker repository → Settings → CI/CD → Runners
   - Verify runners are active

---

## Authentication Issues

### API Returns 401 Unauthorized

**Symptoms:**
```
{"error":"Unauthorized"}
```

**Solutions:**

1. Verify API_TOKEN matches in both places:
```bash
# Backend
grep API_TOKEN .env

# GitLab CI/CD variables
# Check in GitLab UI
```

2. Check Authorization header format:
```bash
curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/pipeline-executions
```

3. Verify token is not expired (if using JWT)

4. Check middleware is applied:
```typescript
// backend/app.ts should have:
app.patch('/pipeline-executions/:id', authMiddleware, ...)
```

### Encryption/Decryption Errors

**Symptoms:**
```
Failed to decrypt GitLab access token
```

**Solutions:**

1. Verify ENCRYPTION_KEY is set:
```bash
echo $ENCRYPTION_KEY
```

2. Check key length (minimum 32 characters):
```bash
echo -n "$ENCRYPTION_KEY" | wc -c
```

3. Ensure same ENCRYPTION_KEY across all services

4. If key changed, re-encrypt tokens:
```bash
# This will require custom migration script
```

---

## GitLab Integration Issues

### Cannot Create Worker Repository

**Symptoms:**
```
Error: Unauthorized
Error: 404 Not Found
```

**Solutions:**

1. Verify GitLab token has correct scopes:
   - Required: `api`, `read_repository`, `write_repository`

2. Test GitLab API access:
```bash
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_HOST/api/v4/user"
```

3. Check GitLab host URL:
```bash
echo $GITLAB_HOST
```

4. Verify token hasn't expired:
   - Go to GitLab → User Settings → Access Tokens
   - Check expiration date

### Cannot Trigger Pipeline

**Symptoms:**
```
Error: 400 Bad Request
Error: Pipeline not found
```

**Solutions:**

1. Verify CI file exists in worker repository:
```bash
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_HOST/api/v4/projects/<project-id>/repository/files/2025-10-18-01%2F.gitlab-ci-claude.yml?ref=main"
```

2. Check CI file path in pipeline trigger:
```bash
# Should match: <version>/.gitlab-ci-<runner>.yml
```

3. Verify branch exists:
```bash
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_HOST/api/v4/projects/<project-id>/repository/branches/main"
```

### Merge Request Not Created

**Symptoms:**
- Pipeline succeeds but no MR created
- glab command fails in upload-results stage

**Solutions:**

1. Check glab is installed in pipeline:
```yaml
# In .gitlab-ci.yml
before_script:
  - which glab || echo "glab not found"
```

2. Verify GITLAB_TOKEN in CI/CD variables

3. Check glab output in pipeline logs

4. Test glab locally:
```bash
cd /tmp/test-repo
glab mr create --title "Test" --description "Test" --fill
```

5. Verify repository URL is correct in file space config

---

## Agent Execution Issues

### Claude Code Not Found

**Symptoms:**
```
spawn claude ENOENT
```

**Solutions:**

1. Install Claude Code CLI in pipeline:
```yaml
before_script:
  - npm install -g @anthropic-ai/claude-code
```

2. Or use docker image with Claude pre-installed

3. Check PATH in pipeline

### ANTHROPIC_API_KEY Missing

**Symptoms:**
```
ANTHROPIC_API_KEY environment variable is required
```

**Solutions:**

1. Add to GitLab CI/CD variables:
   - Go to worker repository → Settings → CI/CD → Variables
   - Add ANTHROPIC_API_KEY

2. Verify variable is not protected (if branch is not protected)

3. Check variable is passed to script:
```yaml
variables:
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
```

### Agent Fails to Clone Repository

**Symptoms:**
```
git clone failed
Permission denied
```

**Solutions:**

1. Verify repository URL format:
```typescript
// Should be: https://gitlab.com/user/repo.git
// Or: git@gitlab.com:user/repo.git
```

2. Check authentication for private repos:
   - For HTTPS: URL should include token
   - For SSH: SSH key should be configured

3. Add deploy token to repository:
   - Go to target repository → Settings → Repository → Deploy Tokens
   - Create token with `read_repository` scope
   - Use in URL: `https://gitlab-ci-token:${DEPLOY_TOKEN}@gitlab.com/user/repo.git`

---

## Performance Issues

### Slow Pipeline Execution

**Solutions:**

1. Use caching in .gitlab-ci.yml:
```yaml
cache:
  paths:
    - node_modules/
    - .apps/
```

2. Use docker image with pre-installed dependencies

3. Increase pipeline timeout

4. Use faster GitLab runners

### High Database Load

**Solutions:**

1. Add database indexes:
```sql
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_sessions_task_id ON sessions(task_id);
CREATE INDEX idx_pipeline_executions_session_id ON pipeline_executions(session_id);
```

2. Reduce polling frequency:
```bash
PIPELINE_POLL_INTERVAL_MS=1200000  # 20 minutes
```

3. Archive old tasks and sessions

### Worker Memory Issues

**Solutions:**

1. Increase worker memory limit:
```yaml
# docker-compose.yaml
services:
  worker:
    mem_limit: 2g
```

2. Clean up old repositories in APPS_DIR:
```bash
find .apps -type d -mtime +7 -exec rm -rf {} \;
```

3. Limit concurrent task processing

---

## Debugging Tips

### Enable Debug Logging

Add to your environment:

```bash
DEBUG=*
LOG_LEVEL=debug
```

### Check Service Health

```bash
# Backend
curl http://localhost:3000/projects

# Database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tasks"

# Worker (check logs)
docker logs --tail 100 adi-worker
```

### Inspect Database State

```bash
# Check recent tasks
psql $DATABASE_URL -c "SELECT id, title, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 10"

# Check pipeline executions
psql $DATABASE_URL -c "SELECT id, status, pipeline_id, created_at FROM pipeline_executions ORDER BY created_at DESC LIMIT 10"

# Check artifacts
psql $DATABASE_URL -c "SELECT id, artifact_type, reference_url FROM pipeline_artifacts ORDER BY created_at DESC LIMIT 10"
```

### Test API Endpoints

```bash
# List projects
curl http://localhost:3000/projects

# Get specific task
curl http://localhost:3000/tasks/<task-id>

# Get pipeline executions for session
curl http://localhost:3000/sessions/<session-id>/pipeline-executions

# Get artifacts for execution
curl http://localhost:3000/pipeline-executions/<execution-id>/artifacts
```

### Reproduce Issues Locally

1. Export production environment variables
2. Run services locally:
```bash
bun run backend/index.ts
bun run backend/index.ts
```

3. Set breakpoints in code
4. Use console.log for debugging

### Check GitLab API

```bash
# Test authentication
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_HOST/api/v4/user"

# List projects
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_HOST/api/v4/projects"

# Get pipeline
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_HOST/api/v4/projects/<project-id>/pipelines/<pipeline-id>"
```

### Monitor Logs in Real-Time

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f worker

# With grep filter
docker compose logs -f worker | grep ERROR

# Last N lines
docker compose logs --tail 100 worker
```

---

## Getting Help

If you've tried the above solutions and still have issues:

1. **Check the logs**:
   - Worker logs: `docker logs adi-worker`
   - Backend logs: `docker logs adi-backend`
   - GitLab pipeline logs

2. **Collect debugging information**:
   - Environment variables (sanitized)
   - Error messages
   - Steps to reproduce
   - Expected vs actual behavior

3. **File an issue**:
   - Include debugging information
   - Include relevant logs
   - Describe what you've already tried

4. **Common debugging commands**:
```bash
# Full system status
docker compose ps
docker compose logs --tail 50

# Database check
psql $DATABASE_URL -c "\dt"
psql $DATABASE_URL -c "SELECT version()"

# API check
curl http://localhost:3000/projects
curl http://localhost:3000/pipeline-executions

# Environment check
env | grep -E '(DATABASE_URL|GITLAB|ANTHROPIC|API_TOKEN|ENCRYPTION_KEY)' | sed 's/=.*/=***/'
```
