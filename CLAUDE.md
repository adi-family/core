mono-repository, submodules, database-infrastructure, migration-management, git-workflow

- Mono repository containing multiple submodules
- Migration submodule uses golang-migrate as primary migration tool
- Docker Compose configuration includes Postgres database
- Postgres database mapped to host port 5436
- Migrations run automatically via Docker container on compose up
- Flat migration structure with timestamp-based naming (YYYYMMDDHHmmss_name.up/down.sql)
- .gitignore follows ignore-all-allow-specific pattern (ignore everything, explicitly allow needed files)
