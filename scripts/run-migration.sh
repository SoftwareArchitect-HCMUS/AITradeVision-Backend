#!/bin/bash

# Script to run database migration
# Usage: ./scripts/run-migration.sh

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-crypto_user}
POSTGRES_DB=${POSTGRES_DB:-crypto_main}

echo "Running database migration..."
echo "Host: $POSTGRES_HOST"
echo "Port: $POSTGRES_PORT"
echo "User: $POSTGRES_USER"
echo "Database: $POSTGRES_DB"
echo ""

# Check if using Docker
if command -v docker &> /dev/null && docker ps | grep -q postgres; then
    echo "Detected Docker PostgreSQL container, using docker exec..."
    docker exec -i postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < scripts/fix-news-schema.sql
else
    # Use psql directly
    if command -v psql &> /dev/null; then
        echo "Using psql directly..."
        PGPASSWORD=${POSTGRES_PASSWORD:-crypto_pass} psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f scripts/fix-news-schema.sql
    else
        echo "Error: psql not found. Please install PostgreSQL client or use Docker."
        exit 1
    fi
fi

echo ""
echo "Migration completed!"

