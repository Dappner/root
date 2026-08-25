-- Add takeaway support to RAG embeddings system

-- =========================
-- EXTENSION SETUP
-- =========================

-- Enable pg_search (ParadeDB) extension if not already enabled
-- This is the same extension used in migration 8 for BM25 indexes
CREATE EXTENSION IF NOT EXISTS pg_search;

-- =========================
-- SCHEMA UPDATES
-- =========================

-- Add content hash to source_takeaways for staleness checks
ALTER TABLE source_takeaways ADD COLUMN IF NOT EXISTS content_sha256 CHAR(64);

-- Index for efficient lookup by hash
CREATE INDEX IF NOT EXISTS idx_source_takeaways_content_sha256 ON source_takeaways(content_sha256);

-- =========================
-- FULL-TEXT SEARCH INDEXES
-- =========================

-- GIN index for full-text search on takeaway title + body (concatenated)
-- This matches the search query which concatenates both fields
CREATE INDEX IF NOT EXISTS idx_source_takeaways_fts ON source_takeaways USING GIN (to_tsvector('english', title || ' ' || body));

-- =========================
-- BM25 SEARCH INDEXES
-- =========================

-- BM25 index for takeaways (title + body concatenated)
-- Uses pg_search (ParadeDB) for BM25 full-text search with relevance ranking
-- Follows same pattern as migration 8 for citations and captures
-- Note: ParadeDB concatenates the fields automatically when indexing
CREATE INDEX IF NOT EXISTS idx_source_takeaways_bm25 ON source_takeaways USING bm25 (id, title, body) WITH (key_field='id');

-- =========================
-- CLEANUP TRIGGER FOR TAKEAWAY EMBEDDINGS
-- =========================

-- Trigger function to delete takeaway embeddings when takeaway is deleted
CREATE OR REPLACE FUNCTION cleanup_takeaway_embeddings()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM rag_embeddings
    WHERE kind = 'takeaway' AND entity_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to cascade delete takeaway embeddings
-- Drop trigger if exists to make idempotent
DROP TRIGGER IF EXISTS trg_cleanup_takeaway_embeddings ON source_takeaways;

CREATE TRIGGER trg_cleanup_takeaway_embeddings
AFTER DELETE ON source_takeaways
FOR EACH ROW
EXECUTE FUNCTION cleanup_takeaway_embeddings();

-- Note: The rag_embeddings.kind field is VARCHAR(20), so no schema change needed
-- 'takeaway' is a valid value that fits within the existing constraint
