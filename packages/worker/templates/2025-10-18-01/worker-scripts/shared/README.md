# Worker Scripts Shared Utilities

Template-specific utilities used by worker pipeline scripts.

## Files

- `api-client.ts` - Backend API client for session/task management
- `logger.ts` - Logging utilities
- `env-validator.ts` - Environment variable validation
- `completion-check.ts` - Task completion verification
- `clarification-check.ts` - Clarification detection
- `workspace-utils.ts` - Workspace management utilities

## Removed Files (Now Bundled)

The following files were previously duplicated here but are now bundled from `packages/shared`:

- ~~`gitlab-api-client.ts`~~ → Now imported from `packages/shared/gitlab-api-client.ts`
- ~~`crypto-utils.ts`~~ → Now imported from `packages/shared/crypto-utils.ts`
- ~~`task-scoring.ts`~~ → Now imported from `packages/shared/task-scoring.ts`

## Architecture Change

**Before:**
```
worker-scripts/
├── shared/
│   ├── gitlab-api-client.ts  ← DUPLICATED!
│   └── ...
└── evaluation-pipeline.ts

→ bun install (installs dependencies)
→ bun run evaluation-pipeline.ts
```

**After (Bundled):**
```
worker-scripts/
├── shared/
│   └── api-client.ts  ← Template-specific only
└── evaluation-pipeline.ts
    ↓ (imports from packages/shared during build)
bundles/
└── evaluation-pipeline.js  ← Standalone bundle

→ bun evaluation-pipeline.js (no install needed!)
```

## Benefits

✅ **Single source of truth** - `packages/shared/` is the only version
✅ **Zero duplication** - no more drift between copies
✅ **Faster CI** - no `bun install` needed
✅ **Smaller uploads** - bundles are ~1 MB vs ~10 MB with node_modules
