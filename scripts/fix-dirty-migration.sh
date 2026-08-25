#!/bin/bash
# Migration diagnostic and recovery helper script
# Usage: ./scripts/fix-dirty-migration.sh

set -e

MIGRATIONS_PATH="./migrations"

echo "🔍 Database Migration Diagnostic Tool"
echo "======================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set DATABASE_URL to your database connection string:"
    echo "  export DATABASE_URL='postgres://user:pass@host:port/dbname?sslmode=disable'"
    echo ""
    exit 1
fi

# Basic validation of DATABASE_URL format
if ! echo "$DATABASE_URL" | grep -q "^postgres"; then
    echo "❌ ERROR: DATABASE_URL does not appear to be a valid PostgreSQL connection string"
    echo "   Expected format: postgres://... or postgresql://..."
    echo ""
    exit 1
fi

echo "📊 Current Migration Status:"
echo "----------------------------"
migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" version 2>&1 || true
echo ""

# Extract version info
VERSION_OUTPUT=$(migrate -path "$MIGRATIONS_PATH" -database "$DATABASE_URL" version 2>&1 || echo "error")

if echo "$VERSION_OUTPUT" | grep -q "dirty"; then
    # Extract version number (handles both with and without leading zeros)
    DIRTY_VERSION=$(echo "$VERSION_OUTPUT" | grep -o '[0-9]\+' | head -1)
    
    # Validate that we got a valid number
    if [ -z "$DIRTY_VERSION" ] || ! [ "$DIRTY_VERSION" -eq "$DIRTY_VERSION" ] 2>/dev/null; then
        echo "❌ ERROR: Could not extract valid version number from migration status"
        exit 1
    fi
    
    echo "❌ DIRTY MIGRATION DETECTED"
    echo "   Version: $DIRTY_VERSION"
    echo "   Status: DIRTY (incomplete)"
    echo ""
    echo "📋 Migration File:"
    # Pad version to match file naming (e.g., 9 -> 000009)
    PADDED_VERSION=$(printf "%06d" "$DIRTY_VERSION" 2>/dev/null || echo "$DIRTY_VERSION")
    MIGRATION_FILE=$(ls "$MIGRATIONS_PATH" 2>/dev/null | grep "^${PADDED_VERSION}_" | grep ".up.sql" | head -1)
    if [ -n "$MIGRATION_FILE" ]; then
        echo "   $MIGRATIONS_PATH/$MIGRATION_FILE"
        echo ""
        echo "📄 Migration Content Preview (first 10 lines):"
        head -10 "$MIGRATIONS_PATH/$MIGRATION_FILE" | sed 's/^/   /'
    fi
    echo ""
    echo "🔧 Recovery Options:"
    echo "-------------------"
    echo ""
    echo "Option 1: Mark migration as complete (if fully applied)"
    echo "   make migrate-force $DIRTY_VERSION"
    echo ""
    echo "Option 2: Rollback to previous version (if not applied)"
    PREV_VERSION=$((DIRTY_VERSION - 1))
    echo "   make migrate-force $PREV_VERSION"
    echo ""
    echo "⚠️  IMPORTANT: First inspect your database to determine which option is correct!"
    echo ""
    echo "📖 For detailed instructions, see: go-api/AGENTS.md"
    echo ""
    
    # Offer to check database schema
    echo "Would you like to check if migration $DIRTY_VERSION was applied? (y/n)"
    read -r response
    
    if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
        echo ""
        echo "🔍 Checking Migration $DIRTY_VERSION..."
        echo "---------------------------------------"
        
        if [ "$DIRTY_VERSION" = "9" ]; then
            echo "Migration 9 adds:"
            echo "  - content_sha256 column to source_takeaways"
            echo "  - Several indexes"
            echo "  - cleanup_takeaway_embeddings() function"
            echo "  - trg_cleanup_takeaway_embeddings trigger"
            echo "  ⚠️  Requires ParadeDB extension for BM25 index"
            echo ""
            
            # Check if ParadeDB is installed
            echo "Checking if ParadeDB extension is installed..."
            PARADEDB_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname='paradedb';" 2>&1 | tr -d ' \t\n' || echo "0")
            
            if [ "$PARADEDB_EXISTS" = "1" ]; then
                echo "✅ ParadeDB extension is installed"
            else
                echo "❌ ParadeDB extension is NOT installed"
                echo ""
                echo "⚠️  This is likely why migration 9 failed!"
                echo "   The BM25 index creation requires ParadeDB."
                echo ""
                echo "Solutions:"
                echo "  1. Install ParadeDB: CREATE EXTENSION IF NOT EXISTS paradedb;"
                echo "  2. Then recover with: make migrate-force 8 && make migrate-up"
                echo ""
            fi
            
            # Check if column exists
            echo "Checking if content_sha256 column exists..."
            COLUMN_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='source_takeaways' AND column_name='content_sha256';" 2>&1 | tr -d ' \t\n' || echo "0")
            
            if [ "$COLUMN_EXISTS" = "1" ]; then
                echo "✅ Column exists - migration partially applied"
                echo ""
                if [ "$PARADEDB_EXISTS" = "1" ]; then
                    echo "Recommended action: make migrate-force 9"
                else
                    echo "Recommended action:"
                    echo "  1. Install ParadeDB extension first"
                    echo "  2. Then: make migrate-force 9"
                fi
            else
                echo "❌ Column does not exist - migration not applied"
                echo ""
                echo "Recommended action: make migrate-force $PREV_VERSION"
            fi
        else
            echo "Automatic checking only available for migration 9"
            echo "Please manually inspect your database"
        fi
    fi
    
elif echo "$VERSION_OUTPUT" | grep -q "error"; then
    echo "❌ ERROR: Could not connect to database or check migration status"
    echo ""
    echo "Please verify:"
    echo "  - DATABASE_URL is correct"
    echo "  - Database is accessible"
    echo "  - Migration table exists"
else
    CURRENT_VERSION=$(echo "$VERSION_OUTPUT" | grep -o '[0-9]\+' | head -1)
    echo "✅ No dirty migrations detected"
    echo "   Current version: $CURRENT_VERSION"
    echo "   Status: CLEAN"
    echo ""
    echo "You can safely run migrations:"
    echo "   make migrate-up"
fi

echo ""
echo "📖 For more help, see: go-api/AGENTS.md"
