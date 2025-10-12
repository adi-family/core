# migrations
migration-management, golang-migrate, database-schema, docker-automation

## Overview
- Uses golang-migrate for database migrations
- Flat structure with timestamp-based naming (no subdirectories)
- Runs automatically via Docker on `docker compose up`
- **Database connection**: postgres://postgres:postgres@postgres:5432/postgres (internal), localhost:5436 (external)

## Migration Files
- Each migration has separate `.up.sql` and `.down.sql` files
- **Format**: `YYYYMMDDHHmmss_description.up.sql` and `YYYYMMDDHHmmss_description.down.sql`
- **Timestamp example**: 20251010223045 (year, month, day, hour, minute, second)
- **Create new migration**: `./create_migration.sh migration_name`

## Available Commands
- **up [N]** - Apply all or N up migrations
- **down [N]** - Rollback N migrations
- **down -all** - Rollback all migrations
- **goto V** - Migrate to specific version V
- **version** - Print current migration version
- **force V** - Set version V without running migration (fix dirty state)
- **drop -f** - Drop everything in database (requires -f flag)

## Common Usage
- **Run migrations**: `docker compose up migrations`
- **Rollback last**: `docker compose run --rm migrations down 1`
- **Rollback all**: `docker compose run --rm migrations down -all`
- **Check version**: `docker compose run --rm migrations version`
- **Go to version**: `docker compose run --rm migrations goto 5`
- **Force version**: `docker compose run --rm migrations force 3`
- **Drop database**: `docker compose run --rm migrations drop -f`
