mono-repository, submodules, database-infrastructure, migration-management, git-workflow, code-style

PROJECT STAGE - CAN EDIT EVERYTHING, NO NEED TO MAINTAIN

- Mono repository containing multiple submodules
- Migration submodule uses golang-migrate as primary migration tool
- Docker Compose configuration includes Postgres database
- Postgres database mapped to host port 5436
- Migrations run automatically via Docker container on compose up
- Flat migration structure with timestamp-based naming (YYYYMMDDHHmmss_name.up/down.sql)
- .gitignore follows ignore-all-allow-specific pattern (ignore everything, explicitly allow needed files)
- No default exports - use named exports for better refactoring and tree-shaking
- No inline default values - avoid || and ?? operators, use explicit conditionals or separate declarations
- Throw exceptions over defaults - prefer explicit errors for missing required values rather than silent fallbacks
- ESLint configured at root with TypeScript and React support
- Pre-push hook runs ESLint to prevent pushing code with lint errors
