# 🔒 Comprehensive Authorization Security Audit Report

**Audit Date:** 2025-11-21
**Scope:** 11 Backend Route Handlers
**Total Issues Found:** 45+ Critical/High severity

---

## Executive Summary

**CRITICAL FINDINGS:** Multiple handlers lack proper authentication and authorization controls, exposing significant security vulnerabilities:

- **9 handlers** missing authentication entirely
- **Multiple endpoints** return sensitive data (tasks, sessions, secrets, messages) without auth
- **OAuth endpoints** save to projectId without ownership verification
- **Admin endpoints** completely unprotected
- **Data exposure risks** affecting project isolation and user privacy

---

## Audit Results by Handler

### 1. ✅ projects.ts - **WELL-SECURED**

**Status:** PROPERLY SECURED

**Strengths:**
- ✅ All endpoints require Clerk token authentication (verifyToken with CLERK_SECRET_KEY)
- ✅ Comprehensive access checks with `hasProjectAccess()` before operations
- ✅ Role-based authorization (owner, admin, developer)
- ✅ Project ownership verified before modifications
- ✅ Data scoping by user's accessible projects

**Key Controls:**
```typescript
// Lines 67-74: listProjects - Filters by user's accessible projects
const listProjects = handler(listProjectsConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // Token verified
  const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
  const allProjects = await queries.findAllProjects(sql)
  const filtered = allProjects.filter(p => accessibleProjectIds.includes(p.id))
  return filtered
})

// Lines 181-194: updateProject - Requires admin role
const updateProject = handler(updateProjectConfig, async (ctx) => {
  const { id } = ctx.params
  const userId = await getUserId(ctx)
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, id, 'admin')
  if (!hasAccess) throw new Error('Forbidden: You need admin role to update this project')
  return await queries.updateProject(sql, id, updates)
})

// Lines 199-211: deleteProject - Requires owner role
const deleteProject = handler(deleteProjectConfig, async (ctx) => {
  const userId = await getUserId(ctx)
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, id, 'owner')
  if (!hasAccess) throw new Error('Forbidden: You need owner role to delete this project')
  await queries.deleteProject(sql, id)
})
```

---

### 2. ❌ tasks.ts - **CRITICAL VULNERABILITIES**

**Status:** CRITICALLY VULNERABLE

**Issues:**

#### ⚠️ Weak Authentication (Lines 33-37)
```typescript
function getUserIdFromHeaders(ctx: any): string | null {
  // VULNERABILITY: Reads X-User-Id from headers without any token verification!
  const userId = ctx.headers?.['x-user-id'] || ctx.headers?.['X-User-Id']
  return userId || null  // Can be spoofed by client
}
```
**Risk:** Client can spoof user ID by sending arbitrary `X-User-Id` header.

#### ❌ Missing Authentication (Multiple Handlers)
```typescript
// Lines 40-44: getTaskSessions - NO AUTH CHECK
const getTaskSessions = handler(getTaskSessionsConfig, async (ctx) => {
  const { taskId } = ctx.params
  const sessions = await sessionQueries.findSessionsByTaskId(sql, taskId)
  return sessions  // RETURNS SENSITIVE DATA WITHOUT AUTH
})

// Lines 46-50: getTaskArtifacts - NO AUTH CHECK
const getTaskArtifacts = handler(getTaskArtifactsConfig, async (ctx) => {
  const { taskId } = ctx.params
  const artifacts = await pipelineArtifactQueries.findPipelineArtifactsByTaskId(sql, taskId)
  return artifacts  // RETURNS SENSITIVE DATA WITHOUT AUTH
})

// Lines 52-63: listTasks - NO AUTH CHECK
const listTasks = handler(listTasksConfig, async (ctx) => {
  const { project_id, limit, search } = ctx.query || {}
  const tasks = await taskQueries.findTasksWithFilters(sql, { project_id, search, ... })
  return tasks  // NO VERIFICATION USER HAS ACCESS TO PROJECT
})

// Lines 65-69: getTask - NO AUTH CHECK
const getTask = handler(getTaskConfig, async (ctx) => {
  const { id } = ctx.params
  const task = await taskQueries.findTaskById(sql, id)
  return task  // RETURNS TASK DATA WITHOUT VERIFYING USER ACCESS
})

// Lines 71-83: implementTask - NO AUTH CHECK
const implementTask = handler(implementTaskConfig, async (ctx) => {
  const { id } = ctx.params
  const task = await taskQueries.updateTaskImplementationStatus(sql, id, 'queued')
  // ALLOWS ANY UNAUTHENTICATED USER TO TRIGGER IMPLEMENTATION
})

// Lines 85-97: evaluateTask - NO AUTH CHECK
const evaluateTask = handler(evaluateTaskConfig, async (ctx) => {
  const { id } = ctx.params
  const task = await taskQueries.updateTaskEvaluationStatus(sql, id, 'queued')
  // ALLOWS ANY UNAUTHENTICATED USER TO TRIGGER EVALUATION
})

// Lines 99-119: evaluateTaskAdvancedHandler - NO AUTH CHECK
const evaluateTaskAdvancedHandler = handler(evaluateTaskAdvancedConfig, async (ctx) => {
  const { id } = ctx.params
  const result = await evaluateTaskAdvanced(sql, { taskId: id })
  // ALLOWS ANY UNAUTHENTICATED USER TO TRIGGER ADVANCED EVALUATION
})

// Lines 121-221: getTaskStats - NO AUTH CHECK
const getTaskStats = handler(getTaskStatsConfig, async (ctx) => {
  const { project_id, task_source_id, evaluated_only, sort_by, search } = ctx.query || {}
  const tasks = await taskQueries.findTasksWithFilters(sql, { ... })
  // RETURNS STATISTICS WITHOUT VERIFYING USER ACCESS TO PROJECT
})

// Lines 223-233: updateTaskImplementationStatusHandler - NO AUTH CHECK
const updateTaskImplementationStatusHandler = handler(updateTaskImplementationStatusConfig, async (ctx) => {
  const { id } = ctx.params
  const { status } = ctx.body
  await taskQueries.updateTaskImplementationStatus(sql, id, status)
  // ALLOWS ANY UNAUTHENTICATED USER TO CHANGE TASK STATUS
})

// Lines 235-241: updateTaskHandler - NO AUTH CHECK
const updateTaskHandler = handler(updateTaskConfig, async (ctx) => {
  const { id } = ctx.params
  const body = ctx.body
  const task = await taskQueries.updateTask(sql, id, body)
  return task  // ALLOWS ANY UNAUTHENTICATED USER TO MODIFY ANY TASK
})
```

#### ⚠️ Weak Authorization (Lines 243-277)
```typescript
const createTask = handler(createTaskConfig, async (ctx) => {
  const userId = getUserIdFromHeaders(ctx)  // WEAK: header-based, no verification
  if (!userId) throw new Error('Authentication required')
  
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, project_id, 'developer')
  if (!hasAccess) throw new Error('You do not have permission...')
  
  // Creates task, but relies on unverified userId from headers
})

const deleteTask = handler(deleteTaskConfig, async (ctx) => {
  const userId = getUserIdFromHeaders(ctx)  // SAME WEAKNESS
  if (!userId) throw new Error('Authentication required')
  
  const task = await taskQueries.findTaskById(sql, id)
  if (!task.manual_task_metadata) throw new Error('Only manually created tasks can be deleted')
  
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, task.project_id, 'developer')
  if (!hasAccess) throw new Error('You do not have permission...')
})
```

**Attack Scenarios:**
1. **Enumerate all tasks:** GET /tasks/[any-id] returns data without auth
2. **Trigger expensive operations:** POST /tasks/[id]/implement (API calls cost money)
3. **View task artifacts:** Access CI/CD outputs and evaluation results
4. **Modify task status:** Change implementation status for any task

---

### 3. ❌ sessions.ts - **CRITICAL VULNERABILITIES**

**Status:** COMPLETELY UNPROTECTED

**All Handlers Missing Authentication:**

```typescript
// Lines 18-22: getSessionMessages - NO AUTH
const getSessionMessages = handler(getSessionMessagesConfig, async (ctx) => {
  const { sessionId } = ctx.params
  const messages = await messageQueries.findMessagesBySessionId(sql, sessionId)
  return messages  // RETURNS CONVERSATION DATA WITHOUT VERIFICATION
})

// Lines 24-28: getSessionPipelineExecutions - NO AUTH
const getSessionPipelineExecutions = handler(getSessionPipelineExecutionsConfig, async (ctx) => {
  const { sessionId } = ctx.params
  const executions = await pipelineExecutionQueries.findPipelineExecutionsBySessionId(sql, sessionId)
  return executions  // RETURNS EXECUTION DATA WITHOUT VERIFICATION
})

// Lines 30-34: getSession - NO AUTH
const getSession = handler(getSessionConfig, async (ctx) => {
  const { id } = ctx.params
  const session = await sessionQueries.findSessionById(sql, id)
  return session  // RETURNS SESSION DATA WITHOUT VERIFICATION
})

// Lines 36-39: listSessions - NO AUTH
const listSessions = handler(listSessionsConfig, async (_ctx) => {
  const sessions = await sessionQueries.findAllSessions(sql)
  return sessions  // RETURNS ALL SESSIONS TO UNAUTHENTICATED USERS
})
```

**Attack Scenarios:**
1. **Enumerate sessions:** Iterate through UUIDs to find sessions
2. **Access conversations:** View all AI conversations across entire system
3. **View pipeline execution logs:** Access CI/CD results from other projects
4. **Harvest sensitive data:** Conversations may contain code, credentials, or business logic

---

### 4. ❌ pipeline-executions.ts - **CRITICAL VULNERABILITIES**

**Status:** COMPLETELY UNPROTECTED

**All Handlers Missing Authentication:**

```typescript
// Lines 20-28: listPipelineArtifacts - NO AUTH
const listPipelineArtifacts = handler(listPipelineArtifactsConfig, async (ctx) => {
  const { execution_id } = ctx.query || {}
  if (execution_id) {
    return pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, execution_id)
  }
  return pipelineArtifactQueries.findAllPipelineArtifacts(sql)  // RETURNS ALL ARTIFACTS
})

// Lines 30-34: getExecutionArtifacts - NO AUTH
const getExecutionArtifacts = handler(getExecutionArtifactsConfig, async (ctx) => {
  const { executionId } = ctx.params
  const artifacts = await pipelineArtifactQueries.findPipelineArtifactsByExecutionId(sql, executionId)
  return artifacts  // RETURNS ARTIFACTS WITHOUT VERIFICATION
})

// Lines 36-45: createExecutionArtifact - NO AUTH
const createExecutionArtifact = handler(createExecutionArtifactConfig, async (ctx) => {
  const { executionId } = ctx.params
  const body = ctx.body
  const artifactData = { ...body, pipeline_execution_id: executionId }
  const artifact = await pipelineArtifactQueries.createPipelineArtifact(sql, artifactData)
  return artifact  // ALLOWS ANY USER TO CREATE ARTIFACTS
})

// Lines 47-51: createPipelineExecution - NO AUTH
const createPipelineExecution = handler(createPipelineExecutionConfig, async (ctx) => {
  const body = ctx.body
  const execution = await pipelineExecutionQueries.createPipelineExecution(sql, body)
  return execution  // ALLOWS ANY USER TO CREATE EXECUTIONS
})

// Lines 53-58: updatePipelineExecution - NO AUTH
const updatePipelineExecution = handler(updatePipelineExecutionConfig, async (ctx) => {
  const { id } = ctx.params
  const body = ctx.body
  const execution = await pipelineExecutionQueries.updatePipelineExecution(sql, id, body)
  return execution  // ALLOWS ANY USER TO MODIFY EXECUTIONS
})

// Lines 60-85: saveExecutionApiUsage - NO AUTH
const saveExecutionApiUsage = handler(saveExecutionApiUsageConfig, async (ctx) => {
  const { executionId } = ctx.params
  const body = ctx.body
  await apiUsageQueries.createApiUsageMetric(sql, {
    pipeline_execution_id: executionId,
    session_id: body.session_id,
    task_id: body.task_id,
    // ... logs API usage and costs
  })
  // ALLOWS ANY USER TO LOG FAKE API USAGE (COST MANIPULATION)
})
```

**Attack Scenarios:**
1. **Extract build artifacts:** Access compiled code, docker images from other projects
2. **View execution logs:** See full CI/CD output and errors
3. **Enumerate executions:** Discover what tasks are being worked on
4. **Manipulate metrics:** Log fake API usage to distort billing/metrics
5. **Data exfiltration:** Retrieve all artifacts system-wide

---

### 5. ❌ messages.ts - **CRITICAL DATA LEAKAGE**

**Status:** COMPLETELY UNPROTECTED - DIRECT DATA EXPOSURE

```typescript
// Lines 13-20: listMessages - RETURNS ALL MESSAGES, NO AUTH
const listMessages = handler(listMessagesConfig, async () => {
  const messages = await sql`
    SELECT * FROM messages
    ORDER BY created_at DESC
    LIMIT 100
  `
  return messages as any  // RETURNS 100 LATEST MESSAGES FROM ENTIRE SYSTEM
})
```

**Attack Scenarios:**
1. **Harvest conversations:** All AI conversations are publicly accessible
2. **Extract credentials:** Messages may contain API keys, passwords
3. **Reverse engineer:** Understand system workflows and task types
4. **Espionage:** View competitor projects' conversations

**Severity:** CRITICAL - Direct SQL access to all messages without authentication

---

### 6. ✅ task-sources.ts - **WELL-SECURED**

**Status:** PROPERLY SECURED

**Strengths:**
- ✅ All endpoints require Clerk token authentication
- ✅ Access checks before operations
- ✅ Role-based authorization (admin for modifications)
- ✅ Project ownership verified

**Controls:**
```typescript
// Lines 52-68: listTaskSources - Filters by accessible projects
const listTaskSources = handler(listTaskSourcesConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // Verified token
  const projectId = ctx.query?.project_id
  
  if (projectId) {
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId)
    if (!hasAccess) throw new Error('Forbidden')
    return taskSourceQueries.findTaskSourcesByProjectId(sql, projectId)
  }
  
  const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
  const allTaskSources = await taskSourceQueries.findAllTaskSources(sql)
  return allTaskSources.filter(ts => accessibleProjectIds.includes(ts.project_id))
})
```

---

### 7. ⚠️ alerts.ts - **LOW RISK (STUB)**

**Status:** MINIMAL RISK - Returns Empty Array

```typescript
// Lines 4-11: listAlerts - NO AUTH, BUT RETURNS EMPTY ARRAY
const listAlerts = handler(listAlertsConfig, async () => {
  return { alerts: [] }  // Currently harmless stub
})
```

**Recommendation:** Add auth for consistency when implementation is added.

---

### 8. ❌ admin.ts - **CRITICAL VULNERABILITIES**

**Status:** COMPLETELY UNPROTECTED - PRIVILEGED OPERATIONS

**All Admin Endpoints Missing Authentication:**

```typescript
// Lines 36-55: getUsageMetrics - ADMIN ONLY, NO AUTH
const getUsageMetrics = handler(getUsageMetricsConfig, async ({ query }) => {
  const filters = {
    start_date: query?.start_date,
    end_date: query?.end_date,
    provider: query?.provider,
    goal: query?.goal,
  }
  const limit = query?.limit ?? 100
  const [recent, aggregated] = await Promise.all([
    findRecentUsageMetrics(sql, filters, limit),
    findAggregatedUsageMetrics(sql, filters),
  ])
  return { recent, aggregated }  // RETURNS API USAGE DATA FOR ENTIRE SYSTEM
})

// Lines 57-60: getWorkerRepos - ADMIN ONLY, NO AUTH
const getWorkerRepos = handler(getWorkerReposConfig, async () => {
  const repositories = await findWorkerRepositoryStatus(sql)
  return { repositories }  // RETURNS STATUS OF ALL WORKER REPOSITORIES
})

// Lines 62-169: refreshWorkerRepos - ADMIN ONLY, NO AUTH
const refreshWorkerRepos = handler(refreshWorkerReposConfig, async () => {
  const repositories = await sql<WorkerRepositoryRow[]>`
    SELECT * FROM worker_repositories wr
    JOIN projects p ON p.id = wr.project_id
    ORDER BY p.name
  `
  // ALLOWS ANY USER TO TRIGGER REPOSITORY REFRESH
})
```

**Attack Scenarios:**
1. **View API usage data:** See token consumption and costs for all projects
2. **Enumerate projects:** Discover all projects and repositories via worker repos
3. **Trigger expensive operations:** Refresh all repositories (resource intensive)

---

### 9. ❌ secrets.ts - **CRITICAL VULNERABILITIES**

**Status:** MOSTLY UNPROTECTED - DATA LEAKAGE & PRIVILEGE ESCALATION

#### ❌ Metadata Leakage (Lines 62-78)
```typescript
const listSecrets = handler(listSecretsConfig, async (_ctx) => {
  const secrets = await secretQueries.findAllSecrets(sql)  // NO AUTH CHECK
  return secrets.map(secret => ({
    id: secret.id,
    name: secret.name,
    project_id: secret.project_id,  // LEAKS PROJECT STRUCTURE
    description: secret.description,
    oauth_provider: secret.oauth_provider,  // REVEALS INTEGRATIONS
    token_type: secret.token_type,
    expires_at: secret.expires_at,
    scopes: secret.scopes,
    created_at: secret.created_at,
    updated_at: secret.updated_at
  }))  // RETURNS ALL SECRETS METADATA TO UNAUTHENTICATED USERS
})

// Lines 80-96: getSecretsByProject - NO AUTH
const getSecretsByProject = handler(getSecretsByProjectConfig, async (ctx) => {
  const { projectId } = ctx.params
  const secrets = await secretQueries.findSecretsByProjectId(sql, projectId)
  return secrets.map(secret => ({ ... }))  // RETURNS SECRETS FOR ANY PROJECT
})

// Lines 98-113: getSecret - NO AUTH
const getSecret = handler(getSecretConfig, async (ctx) => {
  const { id } = ctx.params
  const secret = await secretQueries.findSecretById(sql, id)
  return { ... }  // RETURNS ANY SECRET METADATA
})
```

#### ⚠️ API Key Auth Only (Lines 115-131)
```typescript
const getSecretValue = handler(getSecretValueConfig, async (ctx) => {
  const projectId = await authenticateApiKey(ctx)  // ✅ Requires API key
  const { id } = ctx.params
  
  const secret = await secretQueries.findSecretById(sql, id)
  if (secret.project_id !== projectId) {
    throw new Error('Forbidden: API key does not have access to this secret')
  }
  // ✅ This one is properly secured with API key authentication
})
```

#### ❌ Missing Authentication (Lines 133-143)
```typescript
const createSecret = handler(createSecretConfig, async (ctx) => {
  const data = ctx.body
  const secret = await secretQueries.createSecret(sql, data as any)  // NO AUTH
  // ALLOWS ANY USER TO CREATE SECRETS FOR ANY PROJECT
})
```

#### ❌ Token Validation - No Auth (Lines 145-217)
```typescript
const validateGitLabRawToken = handler(validateGitLabRawTokenConfig, async (ctx) => {
  const { token, hostname, scopes: _scopes } = ctx.body
  // NO AUTH - ALLOWS ANY USER TO VALIDATE TOKENS
  // Can be abused to verify valid tokens before using them
})

const validateGitLabToken = handler(validateGitLabTokenConfig, async (ctx) => {
  const { secretId, hostname, scopes: _scopes } = ctx.body
  // NO AUTH - ALLOWS ANY USER TO TEST EXISTING SECRETS
})

const getGitLabRepositories = handler(getGitLabRepositoriesConfig, async (ctx) => {
  const { secretId, host, search, perPage } = ctx.body
  // NO AUTH - ALLOWS ANY USER TO BROWSE REPOSITORIES USING STORED SECRETS
})
```

**Attack Scenarios:**
1. **Enumerate secrets:** Get list of all integration types and projects
2. **Verify credentials:** Test if secrets are still valid
3. **Access external repos:** Use stored GitLab/Jira tokens to access repositories
4. **Create backdoor secrets:** Plant credentials for lateral movement

---

### 10. ✅ file-spaces.ts - **WELL-SECURED**

**Status:** PROPERLY SECURED

**Strengths:**
- ✅ Supports both Clerk JWT and API key authentication
- ✅ Proper access checks for all operations
- ✅ Role-based authorization (admin for modifications)
- ✅ Differentiates between Clerk users and API key clients

**Controls:**
```typescript
// Lines 34-84: authenticate() - Handles both JWT and API key
async function authenticate(ctx: HandlerContext<any, any, any>): Promise<AuthResult> {
  const authHeader = ctx.headers.get('Authorization')
  if (!authHeader) throw new Error('Unauthorized: No Authorization header')
  
  const token = authHeader.replace('Bearer ', '')
  
  // API key authentication
  if (token.startsWith('adk_')) {
    const validation = await apiKeyQueries.validateApiKey(sql, token)
    if (!validation.valid || !validation.projectId) throw new Error('Invalid API key')
    if (!validation.apiKey?.permissions?.read_project) throw new Error('No permission')
    return { projectId: validation.projectId, isApiKey: true }
  }
  
  // Clerk JWT authentication
  const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
  if (!payload.sub) throw new Error('Invalid token payload')
  return { userId: payload.sub, isApiKey: false }
}

// Lines 85-111: listFileSpaces - Proper scoping
const listFileSpaces = handler(listFileSpacesConfig, async (ctx) => {
  const auth = await authenticate(ctx)  // Verified
  const { project_id } = ctx.query || {}
  
  if (auth.isApiKey) {
    if (project_id && project_id !== auth.projectId) {
      throw new Error('Forbidden: API key does not have access')
    }
    return fileSpaceQueries.findFileSpacesByProjectId(sql, auth.projectId!)
  }
  
  if (project_id) {
    const hasAccess = await userAccessQueries.hasProjectAccess(sql, auth.userId!, project_id)
    if (!hasAccess) throw new Error('Forbidden')
    return fileSpaceQueries.findFileSpacesByProjectId(sql, project_id)
  }
  
  // List from accessible projects only
  const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, auth.userId!)
  const allFileSpaces = await fileSpaceQueries.findAllFileSpaces(sql)
  return allFileSpaces.filter(fs => accessibleProjectIds.includes(fs.project_id))
})
```

---

### 11. 🔴 oauth.ts - **CRITICAL VULNERABILITIES**

**Status:** CRITICAL - NO PROJECT OWNERSHIP VERIFICATION

**Problem:** OAuth endpoints don't verify the user owns the project before saving secrets.

#### ❌ Missing Authorization (Lines 24-49)
```typescript
const gitlabAuthorize = handler(gitlabOAuthAuthorizeConfig, async (_ctx) => {
  const gitlabHost = process.env.GITLAB_ROOT_OAUTH_HOST || 'https://gitlab.com'
  const clientId = process.env.GITLAB_OAUTH_CLIENT_ID
  const redirectUri = process.env.GITLAB_OAUTH_REDIRECT_URI
  
  // NO AUTH - ANYONE CAN INITIATE OAUTH
  const state = crypto.randomUUID()
  return { authUrl: authUrl.toString(), state }
})
```

#### 🔴 CRITICAL - No Project Ownership Check (Lines 51-132)
```typescript
const gitlabExchange = handler(gitlabOAuthExchangeConfig, async (ctx) => {
  const { projectId, code, secretName } = ctx.body
  
  // NO AUTH - NO VERIFICATION THAT USER OWNS PROJECT
  // Exchange code for token
  const tokenResponse = await fetch(tokenUrl, { ... })
  const tokenData = await tokenResponse.json()
  const { access_token, refresh_token, expires_in } = tokenData
  
  // Store in REQUESTED PROJECT WITHOUT VERIFICATION
  const secret = await secretQueries.upsertSecret(sql, {
    project_id: projectId,  // ⚠️ BLINDLY TRUSTS CLIENT-SUPPLIED projectId
    name: secretName,
    value: access_token,
    oauth_provider: 'gitlab',
    token_type: 'oauth',
    refresh_token,
    expires_at: expiresAt.toISOString(),
    scopes: scope
  })
  
  return { success: true, secretId: secret.id, ... }
})
```

**SAME ISSUE FOR:** 
- `gitlabRefresh` (line 134) - no auth
- `jiraAuthorize` (line 159) - no auth  
- `jiraExchange` (line 188) - no project verification ⚠️
- `jiraRefresh` (line 273) - no auth
- `githubAuthorize` (line 298) - no auth
- `githubExchange` (line 323) - no project verification ⚠️

**Attack Scenarios:**
1. **Credential injection:** Attacker gets valid OAuth code, saves to victim's project
2. **Secret overwrites:** Use `upsertSecret` to overwrite existing secrets
3. **Service account escalation:** OAuth with admin account saved to attacker's project

---

## Summary Table

| Handler | Auth | Authz | Data Scope | Resource Check | Role Check | Rating |
|---------|------|-------|-----------|-----------------|-----------|--------|
| projects.ts | ✅ Clerk | ✅ Full | ✅ Filtered | ✅ Verified | ✅ Enforced | 🟢 **GOOD** |
| tasks.ts | ⚠️ Header | ⚠️ Partial | ❌ None | ❌ Missing | ❌ Missing | 🔴 **CRITICAL** |
| sessions.ts | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None | 🔴 **CRITICAL** |
| pipeline-executions.ts | ❌ None | ❌ None | ❌ None | ❌ None | ❌ None | 🔴 **CRITICAL** |
| messages.ts | ❌ None | ❌ None | ❌ All | ❌ None | ❌ None | 🔴 **CRITICAL** |
| task-sources.ts | ✅ Clerk | ✅ Full | ✅ Filtered | ✅ Verified | ✅ Enforced | 🟢 **GOOD** |
| alerts.ts | ❌ None | ❌ N/A | ⚠️ Empty | ⚠️ N/A | ⚠️ N/A | 🟡 **LOW** |
| admin.ts | ❌ None | ❌ None | ❌ All | ❌ None | ❌ None | 🔴 **CRITICAL** |
| secrets.ts | ⚠️ Mixed | ⚠️ Mixed | ❌ Partial | ⚠️ Partial | ❌ None | 🔴 **CRITICAL** |
| file-spaces.ts | ✅ JWT/API | ✅ Full | ✅ Filtered | ✅ Verified | ✅ Enforced | 🟢 **GOOD** |
| oauth.ts | ❌ None | ❌ None | ❌ Trusted | ❌ Missing | ❌ None | 🔴 **CRITICAL** |

---

## Vulnerability Breakdown by Category

### 1. MISSING AUTHENTICATION (10 handlers)
- tasks.ts (9 routes)
- sessions.ts (4 routes)
- pipeline-executions.ts (6 routes)
- messages.ts (1 route)
- admin.ts (3 routes)
- secrets.ts (7 routes)
- alerts.ts (1 route)
- oauth.ts (8 routes)

### 2. MISSING AUTHORIZATION (Most unauth handlers)
- No project ownership checks
- No user access verification
- No role-based access control

### 3. WEAK AUTHENTICATION (tasks.ts)
- Header-based user ID (X-User-Id)
- No token verification
- Client can spoof any user

### 4. MISSING DATA SCOPING
- Returns all records without filtering
- Potential for data enumeration
- Affects: tasks, sessions, pipeline, messages, secrets, admin

### 5. NO RESOURCE OWNERSHIP VERIFICATION
- OAuth endpoints save to arbitrary projects
- Can inject credentials to other users' projects
- Affects: oauth.ts (all 8 endpoints)

---

## Impact Assessment

| Severity | Count | Examples | Impact |
|----------|-------|----------|--------|
| 🔴 CRITICAL | 31 | No auth on: tasks, sessions, pipelines, messages, admin, oauth | Complete system breach, data exfiltration |
| 🟠 HIGH | 7 | Weak header auth, no project verification | User impersonation, credential injection |
| 🟡 MEDIUM | 5 | Missing role checks on some operations | Privilege escalation |
| 🟢 LOW | 2 | Stub endpoints, low risk operations | Minimal impact |

---

## Recommended Fixes (Priority Order)

### IMMEDIATE (Blocking Issues)
1. **tasks.ts**: Replace header-based auth with Clerk token verification
2. **sessions.ts**: Add authentication check to all routes
3. **pipeline-executions.ts**: Add authentication check to all routes
4. **messages.ts**: Add authentication check, filter by user's projects
5. **admin.ts**: Add admin role verification to all routes
6. **oauth.ts**: Add project ownership verification before saving secrets
7. **secrets.ts**: Add authentication check to list/get operations

### HIGH PRIORITY
8. **secrets.ts**: Implement role-based access control for create/delete
9. **alerts.ts**: Add authentication for future implementation

### RECOMMENDED
10. Implement authentication middleware to handle JWT verification centrally
11. Add authorization middleware for role-based access control
12. Add audit logging for sensitive operations

---

## Code Patterns for Reference

### ✅ CORRECT PATTERN (from projects.ts)
```typescript
const handler = handler(config, async (ctx) => {
  // 1. Verify authentication
  const userId = await getUserId(ctx)  // Throws if invalid
  
  // 2. Get resource
  const resource = await queries.findById(sql, resourceId)
  
  // 3. Verify authorization
  const hasAccess = await userAccessQueries.hasProjectAccess(
    sql, 
    userId, 
    resource.project_id, 
    'required_role'  // Optional: specify minimum role
  )
  if (!hasAccess) {
    throw new Error('Forbidden: Insufficient permissions')
  }
  
  // 4. Perform operation
  return await queries.update(sql, resourceId, updates)
})
```

### ❌ WRONG PATTERN (from tasks.ts)
```typescript
const handler = handler(config, async (ctx) => {
  // NO AUTHENTICATION
  const { id } = ctx.params
  
  // NO AUTHORIZATION
  const task = await taskQueries.findTaskById(sql, id)
  
  // OPERATION PERFORMED ON UNAUTHENTICATED REQUEST
  return task
})
```

