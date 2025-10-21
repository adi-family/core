# db
shared-database-logic, postgres-client, crud-queries, worker-cache, typescript

## Overview
- Shared database connection and query logic for backend and worker services
- Exports single postgres client instance used throughout the application
- Contains all database queries (CRUD operations for all tables)
- Worker cache operations for task deduplication and locking

## Files
- **client.ts** - Postgres connection setup, exports `sql` instance (validates DATABASE_URL)
- **worker-cache.ts** - Worker task cache operations (traffic light pattern, locking, queries)
- **projects.ts** - Project CRUD operations (findAll, findById, create, update, delete)
- **tasks.ts** - Task CRUD operations (findAll, findById, create, update, delete)
- **sessions.ts** - Session CRUD operations (findAll, findById, findByTaskId, create, delete)
- **messages.ts** - Message CRUD operations (findAll, findById, findBySessionId, create, delete)

## Usage
```typescript
// Import sql client
import { sql } from '../db/client';

// Import worker cache operations
import { initTrafficLight, findAllWorkerCache } from '../db/worker-cache';

// Import CRUD queries
import * as projectQueries from '../db/projects';
import * as taskQueries from '../db/tasks';
```

## Query Pattern
- All query functions receive `sql: Sql` as first parameter
- Functions follow naming convention: `findAll*`, `find*ById`, `create*`, `update*`, `delete*`
- Update/delete return `Result<T>` type with `ok` boolean and `data` or `error`
- Types imported from `../backend/types`
