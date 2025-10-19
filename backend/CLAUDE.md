# backend
hono-web-framework, orchestrator, webhooks, scheduler, event-driven, functional-programming, typescript, bun-runtime, rest-api

## Architecture
- **Event-driven orchestrator** - Handles issue processing via webhooks, scheduler, or manual triggers
- Functional programming style with pure functions throughout
- Dependency injection via closures for database access
- Factory pattern for handlers and queries
- **Database client** imported from `../db/client`
- **app.ts** composes handler groups and wires routes

## Orchestration (NEW)
Backend now handles all issue processing and pipeline triggering:

### Services
- **services/orchestrator.ts** - Fetches issues from task sources, creates tasks, triggers pipelines
- **services/scheduler.ts** - Optional periodic polling (ENABLE_SCHEDULER=true)

### Trigger Sources
1. **Webhooks** (Recommended) - `/webhooks/gitlab`, `/webhooks/jira`, `/webhooks/github`
2. **Scheduler** - Periodic polling every 10 minutes (configurable)
3. **Manual** - `POST /task-sources/:id/sync`
4. **Hybrid** - Mix webhooks + scheduler for reliability

### Configuration
- `ENABLE_SCHEDULER=true` - Enable periodic polling
- `SCHEDULER_INTERVAL_MS=600000` - Polling interval (10 minutes)
- `DEFAULT_RUNNER=claude` - Default AI runner to use
- `GITLAB_WEBHOOK_SECRET` - Optional webhook verification
- `BACKEND_URL` - Backend URL for self-calls (pipeline triggering)

## Libraries
- **Hono** web framework for routing and request handling
- **postgres** library with tagged templates for SQL queries (automatic parameterization)
- **Bun** runtime for TypeScript execution

## API Design
- **Route structure**: `/resource` (list/create), `/resource/:id` (get/update/delete)
- **Nested routes**: `/sessions/:sessionId/messages` for related resources
- **Status codes**: 201 for create, 204 for delete, 404 for not found
- **JSONB fields**: `data`, `source_*` fields use JSONB, typed as `unknown`
- **AppType export**: app.ts exports AppType for type-safe Hono RPC clients
- **Client documentation**: `/docs/CLIENT_USAGE.md`

## Code Organization
- **handlers/** - HTTP request handlers (CRUD, webhooks)
- **services/** - Business logic (orchestrator, scheduler)
- **task-sources/** - Issue fetching implementations (GitLab, Jira)
- **Database queries** imported from `../db/`
- Handler factory pattern: `createTaskHandlers(sql)` returns object of handlers
- Handlers receive Hono `Context`, use `c.req` and `c.json()`
- Handlers import queries as namespace: `import * as queries from '../../db/tasks'`

## Webhook Endpoints
- `POST /webhooks/gitlab` - GitLab issue events (X-Gitlab-Event, X-Gitlab-Token headers)
- `POST /webhooks/jira` - Jira issue events (webhookEvent in body)
- `POST /webhooks/github` - GitHub issue events (X-GitHub-Event, X-Hub-Signature-256 headers)
- All webhooks match task sources by repo/project and trigger orchestrator