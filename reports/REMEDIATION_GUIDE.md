# 🔧 Security Remediation Guide

## Quick Reference: Handlers to Fix

### Priority 1: CRITICAL - No Authentication (Fix First)

#### 1. tasks.ts (9 vulnerable routes)
**Current Issue:** Header-based authentication without token verification
**Routes affected:** getTask, getTaskSessions, getTaskArtifacts, listTasks, implementTask, evaluateTask, evaluateTaskAdvancedHandler, getTaskStats, updateTaskImplementationStatusHandler, updateTaskHandler

**Fix Template:**
```typescript
// BEFORE (WRONG):
function getUserIdFromHeaders(ctx: any): string | null {
  return ctx.headers?.['x-user-id'] || null  // ❌ NO VERIFICATION
}

// AFTER (CORRECT):
async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
  const authHeader = ctx.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Unauthorized: No Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    throw new Error('Unauthorized: Invalid token format')
  }

  if (!CLERK_SECRET_KEY) {
    throw new Error('Authentication not configured: CLERK_SECRET_KEY missing')
  }

  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
    if (!payload.sub) {
      throw new Error('Unauthorized: Invalid token payload')
    }
    return payload.sub
  } catch (error) {
    logger.error('Token verification failed:', error)
    throw new Error('Unauthorized: Token verification failed')
  }
}
```

**Example fix for getTask:**
```typescript
// BEFORE:
const getTask = handler(getTaskConfig, async (ctx) => {
  const { id } = ctx.params
  const task = await taskQueries.findTaskById(sql, id)
  return task  // ❌ NO AUTH
})

// AFTER:
const getTask = handler(getTaskConfig, async (ctx) => {
  const { id } = ctx.params
  const userId = await getUserId(ctx)  // ✅ Verify token
  
  const task = await taskQueries.findTaskById(sql, id)
  
  // ✅ Verify user has access to the task's project
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, task.project_id)
  if (!hasAccess) {
    throw new Error('Forbidden: You do not have access to this task')
  }
  
  return task
})
```

---

#### 2. sessions.ts (4 routes)
**Current Issue:** No authentication at all
**Routes affected:** getSession, getSessionMessages, getSessionPipelineExecutions, listSessions

**Fix Template:**
```typescript
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'

export function createSessionHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    const authHeader = ctx.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: No Authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      throw new Error('Unauthorized: Invalid token format')
    }

    try {
      const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY })
      if (!payload.sub) {
        throw new Error('Unauthorized: Invalid token payload')
      }
      return payload.sub
    } catch (error) {
      throw new Error('Unauthorized: Token verification failed')
    }
  }

  const getSession = handler(getSessionConfig, async (ctx) => {
    const { id } = ctx.params
    const userId = await getUserId(ctx)  // ✅ Add this
    
    const session = await sessionQueries.findSessionById(sql, id)
    
    // ✅ Add access check (need to verify session belongs to user's project)
    // Assuming sessions have a project_id or task_id you can trace back
    
    return session
  })
  
  // Repeat for other routes...
}
```

---

#### 3. pipeline-executions.ts (6 routes)
**Current Issue:** No authentication at all
**Routes affected:** listPipelineArtifacts, getExecutionArtifacts, createExecutionArtifact, createPipelineExecution, updatePipelineExecution, saveExecutionApiUsage

**Fix:** Apply same pattern as sessions.ts above

---

#### 4. messages.ts (1 route)
**Current Issue:** Returns all system messages without authentication or filtering
**Route affected:** listMessages

**Before:**
```typescript
const listMessages = handler(listMessagesConfig, async () => {
  const messages = await sql`
    SELECT * FROM messages
    ORDER BY created_at DESC
    LIMIT 100
  `
  return messages as any  // ❌ RETURNS ALL MESSAGES
})
```

**After:**
```typescript
const listMessages = handler(listMessagesConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // ✅ Add auth
  
  // ✅ Get user's accessible projects
  const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
  
  // ✅ Filter messages to accessible projects only
  const messages = await sql`
    SELECT m.* FROM messages m
    WHERE m.project_id = ANY(${accessibleProjectIds})
    ORDER BY m.created_at DESC
    LIMIT 100
  `
  return messages as any
})
```

---

#### 5. admin.ts (3 routes)
**Current Issue:** Admin endpoints with no authentication or role verification
**Routes affected:** getUsageMetrics, getWorkerRepos, refreshWorkerRepos

**Fix Template:**
```typescript
import { verifyToken } from '@clerk/backend'
import { CLERK_SECRET_KEY } from '../config'

export function createAdminHandlers(sql: Sql) {
  async function getUserId(ctx: HandlerContext<any, any, any>): Promise<string> {
    // Same as above
  }
  
  async function verifyAdminRole(ctx: HandlerContext<any, any, any>): Promise<string> {
    const userId = await getUserId(ctx)
    
    // Check if user is admin (you'll need to define what "admin" means)
    // Option 1: Check if user has admin role in a default/system project
    // Option 2: Check a system_admins table
    // Option 3: Check Clerk org membership
    
    const isAdmin = await checkIsSystemAdmin(sql, userId)
    if (!isAdmin) {
      throw new Error('Forbidden: Admin access required')
    }
    
    return userId
  }

  const getUsageMetrics = handler(getUsageMetricsConfig, async (ctx) => {
    const userId = await verifyAdminRole(ctx)  // ✅ Add admin check
    
    const filters = {
      start_date: ctx.query?.start_date,
      end_date: ctx.query?.end_date,
      provider: ctx.query?.provider,
      goal: ctx.query?.goal,
    }

    const [recent, aggregated] = await Promise.all([
      findRecentUsageMetrics(sql, filters),
      findAggregatedUsageMetrics(sql, filters),
    ])

    return { recent, aggregated }
  })
  
  // Repeat for other admin routes...
}
```

---

### Priority 2: CRITICAL - OAuth Credential Injection (Fix Second)

#### oauth.ts (8 routes)
**Current Issue:** OAuth handlers don't verify project ownership before saving secrets
**Routes affected:** gitlabAuthorize, gitlabExchange, gitlabRefresh, jiraAuthorize, jiraExchange, jiraRefresh, githubAuthorize, githubExchange

**Problem Code:**
```typescript
const gitlabExchange = handler(gitlabOAuthExchangeConfig, async (ctx) => {
  const { projectId, code, secretName } = ctx.body  // ⚠️ Trusts client input
  
  // ... exchange code for token ...
  
  const secret = await secretQueries.upsertSecret(sql, {
    project_id: projectId,  // ❌ BLINDLY SAVES TO ANY PROJECT
    name: secretName,
    value: access_token,
    oauth_provider: 'gitlab',
    // ...
  })
})
```

**Fixed Code:**
```typescript
const gitlabExchange = handler(gitlabOAuthExchangeConfig, async (ctx) => {
  // ✅ ADD AUTHENTICATION
  const userId = await getUserId(ctx)
  
  const { projectId, code, secretName } = ctx.body
  
  // ✅ ADD PROJECT OWNERSHIP VERIFICATION
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId, 'admin')
  if (!hasAccess) {
    throw new Error('Forbidden: You do not have admin access to this project')
  }
  
  // ... exchange code for token ...
  
  const secret = await secretQueries.upsertSecret(sql, {
    project_id: projectId,  // ✅ NOW VERIFIED
    name: secretName,
    value: access_token,
    oauth_provider: 'gitlab',
    // ...
  })
})
```

**Apply same fix to:**
- gitlabRefresh
- jiraExchange
- jiraRefresh
- githubExchange

**Also add auth to:**
- gitlabAuthorize
- jiraAuthorize
- githubAuthorize

(Even though authorize endpoints just return URLs, they should still require auth to prevent enumeration)

---

### Priority 3: HIGH - Secrets Metadata Leakage (Fix Third)

#### secrets.ts (3 list/get routes + 4 validation routes)
**Current Issue:** Metadata endpoints have no authentication, validation endpoints no auth

**Metadata Routes:**
```typescript
// BEFORE:
const listSecrets = handler(listSecretsConfig, async (_ctx) => {
  const secrets = await secretQueries.findAllSecrets(sql)  // ❌ NO AUTH
  return secrets.map(secret => ({
    id: secret.id,
    name: secret.name,
    project_id: secret.project_id,  // ❌ LEAKS PROJECT STRUCTURE
    description: secret.description,
    // ...
  }))
})

// AFTER:
const listSecrets = handler(listSecretsConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // ✅ ADD AUTH
  
  // ✅ Get user's accessible projects
  const accessibleProjectIds = await userAccessQueries.getUserAccessibleProjects(sql, userId)
  
  // ✅ Filter secrets to accessible projects
  const secrets = await secretQueries.findAllSecrets(sql)
  const filtered = secrets.filter(s => accessibleProjectIds.includes(s.project_id))
  
  return filtered.map(secret => ({
    id: secret.id,
    name: secret.name,
    project_id: secret.project_id,
    description: secret.description,
    // ...
  }))
})

const getSecretsByProject = handler(getSecretsByProjectConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // ✅ ADD AUTH
  const { projectId } = ctx.params
  
  // ✅ Verify access
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, projectId)
  if (!hasAccess) {
    throw new Error('Forbidden: You do not have access to this project')
  }
  
  const secrets = await secretQueries.findSecretsByProjectId(sql, projectId)
  return secrets.map(secret => ({ ... }))
})

const getSecret = handler(getSecretConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // ✅ ADD AUTH
  const { id } = ctx.params
  
  const secret = await secretQueries.findSecretById(sql, id)
  
  // ✅ Verify access to secret's project
  const hasAccess = await userAccessQueries.hasProjectAccess(sql, userId, secret.project_id)
  if (!hasAccess) {
    throw new Error('Forbidden: You do not have access to this secret')
  }
  
  return { ... }
})
```

**Token Validation Routes:**
```typescript
// BEFORE:
const validateGitLabRawToken = handler(validateGitLabRawTokenConfig, async (ctx) => {
  const { token, hostname, scopes } = ctx.body
  // ❌ NO AUTH - ALLOWS VERIFYING ANY TOKEN
})

// AFTER:
const validateGitLabRawToken = handler(validateGitLabRawTokenConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // ✅ ADD AUTH
  const { token, hostname, scopes } = ctx.body
  // ✅ NOW ONLY AUTHENTICATED USERS CAN VALIDATE
})
```

**Apply to:**
- validateGitLabToken
- getGitLabRepositories
- validateJiraRawToken
- validateJiraToken

---

### Priority 4: LOW - Alerts Consistency (Fix Last)

#### alerts.ts (1 route)
**Current Issue:** No authentication (but returns empty array so low risk)

**Fix for consistency:**
```typescript
// BEFORE:
const listAlerts = handler(listAlertsConfig, async () => {
  return { alerts: [] }
})

// AFTER:
const listAlerts = handler(listAlertsConfig, async (ctx) => {
  const userId = await getUserId(ctx)  // ✅ ADD AUTH FOR CONSISTENCY
  return { alerts: [] }
})
```

---

## Implementation Steps

1. **Create shared auth utility** (if not already done)
   - Move `getUserId()` function to a shared module
   - Use it across all handlers
   - This ensures consistency and makes future updates easier

2. **Fix handlers in order:**
   - Task.ts (most commonly used)
   - Sessions.ts (sensitive data)
   - Pipeline-executions.ts (sensitive data)
   - Messages.ts (complete data breach risk)
   - Admin.ts (privileged operations)
   - OAuth.ts (credential injection)
   - Secrets.ts (metadata + values)
   - Alerts.ts (low priority)

3. **Test each fix:**
   - Verify authenticated users can access their data
   - Verify unauthenticated users get 401 Unauthorized
   - Verify users cannot access other projects' data
   - Test role-based access where applicable

4. **Add logging:**
   - Log authentication failures
   - Log authorization denials
   - Log sensitive operations (create secret, update OAuth, etc.)

5. **Update API documentation:**
   - Document required authentication method
   - Document required roles/permissions
   - Document expected error codes

---

## Testing Checklist

For each handler, verify:

- [ ] Unauthenticated request returns 401 Unauthorized
- [ ] Invalid token returns 401 Unauthorized
- [ ] Authenticated user can access their own data
- [ ] Authenticated user cannot access other users' data
- [ ] Admin operations require admin role
- [ ] Project operations require project access
- [ ] Data is properly filtered by user's accessible projects
- [ ] Project ownership is verified before resource creation
- [ ] Error messages don't leak sensitive information

---

## Estimated Time

- tasks.ts: 1-2 hours (9 routes, most critical)
- sessions.ts: 1 hour (4 routes, straightforward)
- pipeline-executions.ts: 1 hour (6 routes, straightforward)
- messages.ts: 30 minutes (1 route + filtering)
- admin.ts: 1 hour (3 routes + admin role check)
- oauth.ts: 2 hours (8 routes + project verification)
- secrets.ts: 1-2 hours (7 routes, sensitive operations)
- alerts.ts: 15 minutes (1 route)
- Testing & QA: 2-3 hours

**Total: 10-14 hours** (equivalent to 1-2 development days)

---

## Safer than Production

Once fixed, this system will be more secure than many production systems because:

- Proper token verification with Clerk
- Project-level access control
- Role-based authorization
- Resource ownership verification
- Consistent authentication pattern across handlers

