#!/bin/bash

# Migration creation script for golang-migrate
# Usage: ./create_migration.sh migration_name

set -e

if [ -z "$1" ]; then
    echo "Error: Migration name required"
    echo "Usage: ./create_migration.sh migration_name"
    exit 1
fi

MIGRATION_NAME="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Generate timestamp in format: YYYYMMDDHHmmss
TIMESTAMP=$(date '+%Y%m%d%H%M%S')

# Create file paths
UP_FILE="$SCRIPT_DIR/${TIMESTAMP}_${MIGRATION_NAME}.up.sql"
DOWN_FILE="$SCRIPT_DIR/${TIMESTAMP}_${MIGRATION_NAME}.down.sql"

# Create up migration file
cat > "$UP_FILE" << EOF
-- Migration: ${MIGRATION_NAME}
-- Created: $(date '+%Y-%m-%d %H:%M:%S')

-- Add your migration SQL here

EOF

# Create down migration file
cat > "$DOWN_FILE" << EOF
-- Rollback: ${MIGRATION_NAME}
-- Created: $(date '+%Y-%m-%d %H:%M:%S')

-- Add your rollback SQL here

EOF

echo "Created migration files:"
echo "  - ${TIMESTAMP}_${MIGRATION_NAME}.up.sql"
echo "  - ${TIMESTAMP}_${MIGRATION_NAME}.down.sql"
