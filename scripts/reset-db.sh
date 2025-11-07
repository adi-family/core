#!/bin/bash
# Database reset script - drops all data and reruns migrations

set -e

echo "🗑️  Dropping database schema..."
PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1

echo "🔨 Rebuilding migrations container..."
docker compose build migrations > /dev/null 2>&1

echo "🚀 Running migrations..."
docker compose up migrations 2>&1 | grep -E "(^\d{14}\/u|error:|exited with code)" || true

echo "✅ Database reset complete!"
echo ""
echo "📊 Current tables:"
PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d postgres -c "\dt"
