-- ============================================================================
-- Add Source Metadata Fields (author and published_at)
-- ============================================================================
-- Consolidates source metadata improvements:
-- - Moves author from JSONB metadata to dedicated column
-- - Adds published_at timestamp for better sorting/filtering
-- ============================================================================

-- ============================================================================
-- 1. Add author column
-- ============================================================================
-- Schema change: nullable because not all sources have an author (e.g., videos, podcasts)
ALTER TABLE sources ADD COLUMN author VARCHAR(255);

-- Backfill author from existing metadata when present
UPDATE sources
SET author = NULLIF(metadata->>'author', '')
WHERE metadata ? 'author';

-- Remove author key from metadata now that it's stored in a dedicated column
UPDATE sources
SET metadata = metadata - 'author'
WHERE metadata ? 'author';

-- ============================================================================
-- 2. Add published_at column
-- ============================================================================
ALTER TABLE sources ADD COLUMN published_at TIMESTAMP;

-- Index for efficient filtering and sorting by publication date
CREATE INDEX idx_sources_user_published_at
    ON sources(user_id, published_at DESC NULLS LAST);
