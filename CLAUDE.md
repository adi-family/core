# adi-simple
mono-repository, typescript, database-infrastructure, migration-management, git-workflow, lint-automation

PROJECT STAGE - CAN EDIT EVERYTHING, NO NEED TO MAINTAIN

## Project Overview
- Mono repository containing migrations, backend, worker, and db submodules
- **.gitignore** follows ignore-all-allow-specific pattern (ignore everything, explicitly allow needed files)
- **db/** directory contains shared database logic (client connection, queries) used by backend and worker

## Infrastructure
- **Docker Compose** manages Postgres database and migrations
- **Postgres database** exposed on host port 5436 (internal: postgres:5432)
- **migrations/** submodule uses golang-migrate for schema management
- **Migrations** run automatically via Docker container on `docker compose up`
- **Migration naming** follows timestamp format: `YYYYMMDDHHmmss_name.up/down.sql`

## Development Tools
- **ESLint** configured at root with TypeScript and React support
- **package.json** at root includes ESLint configuration and dependencies
- **Pre-push hook** runs ESLint to prevent pushing code with lint errors
