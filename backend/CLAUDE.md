# backend
hono-web-framework, functional-programming, typescript, bun-runtime, dependency-injection, rest-api

## Architecture
- Functional programming style with pure functions throughout
- Dependency injection via closures for database access
- Factory pattern for handlers and queries
- **db.ts** exports single shared `sql` instance for database connection
- **app.ts** composes handler groups and wires routes

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
- **queries/** directory contains all SQL query functions
- **handlers/** directory contains HTTP request handlers
- Handler factory pattern: `createTaskHandlers(sql)` returns object of handlers
- Query factory pattern: `findTaskById(sql)` returns async function
- Handlers receive Hono `Context`, use `c.req` and `c.json()`