#!/bin/bash

# Script to cleanup old BullMQ job metadata (Hash tables) from Redis
# Usage: ./scripts/cleanup-redis-hashtables.sh

set +e  # Don't exit on error

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}

echo "Cleaning up BullMQ job metadata (Hash tables) from Redis..."
echo "Host: $REDIS_HOST"
echo "Port: $REDIS_PORT"
echo ""

# Check if using Docker
if command -v docker &> /dev/null && docker ps | grep -q redis; then
    echo "Detected Docker Redis container, using docker exec..."
    REDIS_CMD="docker exec -i crypto-redis redis-cli"
else
    # Use redis-cli directly
    if command -v redis-cli &> /dev/null; then
        echo "Using redis-cli directly..."
        REDIS_CMD="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
    else
        echo "Error: redis-cli not found. Please install Redis client or use Docker."
        exit 1
    fi
fi

# Queue name
QUEUE_NAME="crawl-news"

echo "Cleaning up job metadata for queue: $QUEUE_NAME"
echo ""

# Find all job metadata keys (Hash tables)
echo "Finding job metadata keys..."
JOB_KEYS=$($REDIS_CMD KEYS "bull:${QUEUE_NAME}:*" 2>/dev/null | grep -E "^bull:${QUEUE_NAME}:[0-9]+$" || echo "")

if [ -z "$JOB_KEYS" ]; then
    echo "No job metadata keys found."
    exit 0
fi

JOB_COUNT=$(echo "$JOB_KEYS" | grep -v "^$" | wc -l | tr -d ' ')
echo "Found $JOB_COUNT job metadata entries (Hash tables)"
echo ""

# Get all active job IDs from lists
echo "Collecting active job IDs..."
COMPLETED_JOBS=""
FAILED_JOBS=""
WAIT_JOBS=""
ACTIVE_JOBS=""

# Get completed jobs
COMPLETED_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:completed" 2>/dev/null || echo "none")
if [ "$COMPLETED_TYPE" = "list" ]; then
    COMPLETED_JOBS=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:completed" 0 -1 2>/dev/null || echo "")
elif [ "$COMPLETED_TYPE" = "zset" ]; then
    COMPLETED_JOBS=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:completed" 0 -1 2>/dev/null || echo "")
fi

# Get failed jobs
FAILED_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:failed" 2>/dev/null || echo "none")
if [ "$FAILED_TYPE" = "list" ]; then
    FAILED_JOBS=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:failed" 0 -1 2>/dev/null || echo "")
elif [ "$FAILED_TYPE" = "zset" ]; then
    FAILED_JOBS=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:failed" 0 -1 2>/dev/null || echo "")
fi

# Get waiting jobs
WAIT_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:wait" 2>/dev/null || echo "none")
if [ "$WAIT_TYPE" = "list" ]; then
    WAIT_JOBS=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:wait" 0 -1 2>/dev/null || echo "")
elif [ "$WAIT_TYPE" = "zset" ]; then
    WAIT_JOBS=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:wait" 0 -1 2>/dev/null || echo "")
fi

# Get active jobs
ACTIVE_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:active" 2>/dev/null || echo "none")
if [ "$ACTIVE_TYPE" = "list" ]; then
    ACTIVE_JOBS=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:active" 0 -1 2>/dev/null || echo "")
elif [ "$ACTIVE_TYPE" = "zset" ]; then
    ACTIVE_JOBS=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:active" 0 -1 2>/dev/null || echo "")
fi

# Combine all active job IDs
ALL_ACTIVE_JOBS=$(echo "$COMPLETED_JOBS $FAILED_JOBS $WAIT_JOBS $ACTIVE_JOBS" | tr ' ' '\n' | grep -v "^$" | sort -u)
ACTIVE_COUNT=$(echo "$ALL_ACTIVE_JOBS" | grep -v "^$" | wc -l | tr -d ' ')

echo "Active jobs in lists: $ACTIVE_COUNT"
echo ""

# Delete old job metadata (keep only recent ones)
MAX_KEEP=100  # Keep only 100 most recent job metadata (giảm từ 200 xuống 100 để xóa nhiều hơn)
echo "Deleting old job metadata (keeping only $MAX_KEEP most recent)..."
echo ""

# Sort job keys by job ID (assuming higher ID = newer)
SORTED_JOB_IDS=$(echo "$JOB_KEYS" | sed "s/bull:${QUEUE_NAME}://" | sort -n | tail -n $MAX_KEEP)

DELETED_COUNT=0
KEPT_COUNT=0

echo "$JOB_KEYS" | while read job_key; do
    if [ ! -z "$job_key" ]; then
        # Extract job ID from key
        JOB_ID=$(echo "$job_key" | sed "s/bull:${QUEUE_NAME}://")
        
        # Check if job ID is in keep list (most recent 100)
        if echo "$SORTED_JOB_IDS" | grep -q "^${JOB_ID}$"; then
            KEPT_COUNT=$((KEPT_COUNT + 1))
        else
            # Delete job metadata and data (old jobs)
            $REDIS_CMD DEL "$job_key" 2>/dev/null || true
            $REDIS_CMD DEL "${job_key}:data" 2>/dev/null || true
            DELETED_COUNT=$((DELETED_COUNT + 1))
            if [ $((DELETED_COUNT % 100)) -eq 0 ]; then
                echo "  Deleted $DELETED_COUNT job metadata entries..."
            fi
        fi
    fi
done

echo ""
echo "Cleanup completed!"
echo "  Total job metadata before: $JOB_COUNT"
echo "  Kept (most recent): $MAX_KEEP"
echo "  Deleted: $DELETED_COUNT"

