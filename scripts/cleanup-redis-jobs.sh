#!/bin/bash

# Script to cleanup old BullMQ jobs from Redis
# Usage: ./scripts/cleanup-redis-jobs.sh

set +e  # Don't exit on error, we'll handle errors manually

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}

echo "Cleaning up BullMQ jobs from Redis..."
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

echo "Cleaning up queue: $QUEUE_NAME"
echo ""

# Cleanup old job metadata (Hash tables)
echo "Cleaning up old job metadata (Hash tables)..."
JOB_KEYS=$($REDIS_CMD KEYS "bull:${QUEUE_NAME}:*" 2>/dev/null | grep -E "^bull:${QUEUE_NAME}:[0-9]+$" || echo "")
if [ ! -z "$JOB_KEYS" ]; then
    JOB_COUNT=$(echo "$JOB_KEYS" | grep -v "^$" | wc -l | tr -d ' ')
    echo "  Found $JOB_COUNT job metadata entries (Hash tables)"
    
    if [ "$JOB_COUNT" -gt 0 ] 2>/dev/null; then
        # Get job IDs from completed and failed lists first
        COMPLETED_JOBS=""
        FAILED_JOBS=""
        WAIT_JOBS=""
        ACTIVE_JOBS_LIST=""
        
        COMPLETED_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:completed" 2>/dev/null || echo "none")
        if [ "$COMPLETED_TYPE" = "list" ]; then
            COMPLETED_JOBS=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:completed" 0 -1 2>/dev/null || echo "")
        elif [ "$COMPLETED_TYPE" = "zset" ]; then
            COMPLETED_JOBS=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:completed" 0 -1 2>/dev/null || echo "")
        fi
        
        FAILED_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:failed" 2>/dev/null || echo "none")
        if [ "$FAILED_TYPE" = "list" ]; then
            FAILED_JOBS=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:failed" 0 -1 2>/dev/null || echo "")
        elif [ "$FAILED_TYPE" = "zset" ]; then
            FAILED_JOBS=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:failed" 0 -1 2>/dev/null || echo "")
        fi
        
        WAIT_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:wait" 2>/dev/null || echo "none")
        if [ "$WAIT_TYPE" = "list" ]; then
            WAIT_JOBS=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:wait" 0 -1 2>/dev/null || echo "")
        elif [ "$WAIT_TYPE" = "zset" ]; then
            WAIT_JOBS=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:wait" 0 -1 2>/dev/null || echo "")
        fi
        
        ACTIVE_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:active" 2>/dev/null || echo "none")
        if [ "$ACTIVE_TYPE" = "list" ]; then
            ACTIVE_JOBS_LIST=$($REDIS_CMD LRANGE "bull:${QUEUE_NAME}:active" 0 -1 2>/dev/null || echo "")
        elif [ "$ACTIVE_TYPE" = "zset" ]; then
            ACTIVE_JOBS_LIST=$($REDIS_CMD ZRANGE "bull:${QUEUE_NAME}:active" 0 -1 2>/dev/null || echo "")
        fi
        
        # Keep only most recent job metadata (max 200)
        MAX_KEEP_METADATA=200
        echo "  Keeping only $MAX_KEEP_METADATA most recent job metadata (deleting old ones)..."
        
        # Sort job keys by ID (higher ID = newer) and keep only recent ones
        SORTED_JOB_IDS=$(echo "$JOB_KEYS" | sed "s/bull:${QUEUE_NAME}://" | sort -n | tail -n $MAX_KEEP_METADATA)
        
        DELETED_COUNT=0
        echo "$JOB_KEYS" | while read job_key; do
            if [ ! -z "$job_key" ]; then
                # Extract job ID from key
                JOB_ID=$(echo "$job_key" | sed "s/bull:${QUEUE_NAME}://")
                
                # Check if job ID is in keep list (most recent 200)
                if ! echo "$SORTED_JOB_IDS" | grep -q "^${JOB_ID}$"; then
                    # Delete old job metadata and data
                    $REDIS_CMD DEL "$job_key" 2>/dev/null || true
                    $REDIS_CMD DEL "${job_key}:data" 2>/dev/null || true
                    DELETED_COUNT=$((DELETED_COUNT + 1))
                    if [ $((DELETED_COUNT % 100)) -eq 0 ]; then
                        echo "    Deleted $DELETED_COUNT job metadata entries..."
                    fi
                fi
            fi
        done
        
        echo "  Cleaned up job metadata (kept $MAX_KEEP_METADATA most recent, deleted $DELETED_COUNT old ones)"
    else
        echo "  No job metadata found"
    fi
else
    echo "  No job metadata keys found"
fi
echo ""

# Helper function to get count safely
get_count() {
    local key=$1
    local type=$($REDIS_CMD TYPE "$key" 2>/dev/null || echo "none")
    case "$type" in
        "list")
            $REDIS_CMD LLEN "$key" 2>/dev/null || echo "0"
            ;;
        "zset")
            $REDIS_CMD ZCARD "$key" 2>/dev/null || echo "0"
            ;;
        "set")
            $REDIS_CMD SCARD "$key" 2>/dev/null || echo "0"
            ;;
        "hash")
            $REDIS_CMD HLEN "$key" 2>/dev/null || echo "0"
            ;;
        *)
            echo "0"
            ;;
    esac
}

# Count jobs before cleanup
COMPLETED_BEFORE=$(get_count "bull:${QUEUE_NAME}:completed")
FAILED_BEFORE=$(get_count "bull:${QUEUE_NAME}:failed")
WAIT_BEFORE=$(get_count "bull:${QUEUE_NAME}:wait")
ACTIVE_BEFORE=$(get_count "bull:${QUEUE_NAME}:active")

echo "Jobs before cleanup:"
echo "  Completed: $COMPLETED_BEFORE"
echo "  Failed: $FAILED_BEFORE"
echo "  Waiting: $WAIT_BEFORE"
echo "  Active: $ACTIVE_BEFORE"
echo ""

# Cleanup completed jobs (keep last 100)
COMPLETED_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:completed" 2>/dev/null || echo "none")
if [ "$COMPLETED_TYPE" = "list" ] && [ "$COMPLETED_BEFORE" -gt 100 ] 2>/dev/null; then
    echo "Removing old completed jobs (keeping last 100)..."
    $REDIS_CMD LTRIM "bull:${QUEUE_NAME}:completed" 0 99 2>/dev/null || true
    
    # Also remove job data and metadata for removed jobs
    $REDIS_CMD LRANGE "bull:${QUEUE_NAME}:completed" 100 -1 2>/dev/null | while read job_id; do
        if [ ! -z "$job_id" ] && [ "$job_id" != "0" ]; then
            $REDIS_CMD DEL "bull:${QUEUE_NAME}:${job_id}" 2>/dev/null || true
            $REDIS_CMD DEL "bull:${QUEUE_NAME}:${job_id}:data" 2>/dev/null || true
        fi
    done
elif [ "$COMPLETED_TYPE" = "zset" ] && [ "$COMPLETED_BEFORE" -gt 100 ] 2>/dev/null; then
    echo "Removing old completed jobs from sorted set (keeping last 100)..."
    # Remove oldest jobs (lowest scores)
    $REDIS_CMD ZREMRANGEBYRANK "bull:${QUEUE_NAME}:completed" 0 -101 2>/dev/null || true
fi

# Cleanup failed jobs (keep last 50)
FAILED_TYPE=$($REDIS_CMD TYPE "bull:${QUEUE_NAME}:failed" 2>/dev/null || echo "none")
if [ "$FAILED_TYPE" = "list" ] && [ "$FAILED_BEFORE" -gt 50 ] 2>/dev/null; then
    echo "Removing old failed jobs (keeping last 50)..."
    $REDIS_CMD LTRIM "bull:${QUEUE_NAME}:failed" 0 49 2>/dev/null || true
    
    # Also remove job data and metadata for removed jobs
    $REDIS_CMD LRANGE "bull:${QUEUE_NAME}:failed" 50 -1 2>/dev/null | while read job_id; do
        if [ ! -z "$job_id" ] && [ "$job_id" != "0" ]; then
            $REDIS_CMD DEL "bull:${QUEUE_NAME}:${job_id}" 2>/dev/null || true
            $REDIS_CMD DEL "bull:${QUEUE_NAME}:${job_id}:data" 2>/dev/null || true
        fi
    done
elif [ "$FAILED_TYPE" = "zset" ] && [ "$FAILED_BEFORE" -gt 50 ] 2>/dev/null; then
    echo "Removing old failed jobs from sorted set (keeping last 50)..."
    # Remove oldest jobs (lowest scores)
    $REDIS_CMD ZREMRANGEBYRANK "bull:${QUEUE_NAME}:failed" 0 -51 2>/dev/null || true
fi

# Count jobs after cleanup
COMPLETED_AFTER=$(get_count "bull:${QUEUE_NAME}:completed")
FAILED_AFTER=$(get_count "bull:${QUEUE_NAME}:failed")

echo ""
echo "Jobs after cleanup:"
if [ "$COMPLETED_BEFORE" -gt 0 ] 2>/dev/null && [ "$COMPLETED_AFTER" -gt 0 ] 2>/dev/null; then
    REMOVED_COMPLETED=$((COMPLETED_BEFORE - COMPLETED_AFTER))
    echo "  Completed: $COMPLETED_AFTER (removed $REMOVED_COMPLETED)"
else
    echo "  Completed: $COMPLETED_AFTER"
fi

if [ "$FAILED_BEFORE" -gt 0 ] 2>/dev/null && [ "$FAILED_AFTER" -gt 0 ] 2>/dev/null; then
    REMOVED_FAILED=$((FAILED_BEFORE - FAILED_AFTER))
    echo "  Failed: $FAILED_AFTER (removed $REMOVED_FAILED)"
else
    echo "  Failed: $FAILED_AFTER"
fi
echo ""
echo "Cleanup completed!"

