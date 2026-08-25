-- =========================
-- FULL-TEXT SEARCH INDEXES
-- =========================

-- Add GIN index for full-text search on citations.text
CREATE INDEX IF NOT EXISTS idx_citations_text_search ON citations USING GIN (to_tsvector('english', text));

-- Add GIN index for full-text search on captures.content
CREATE INDEX IF NOT EXISTS idx_captures_content_search ON captures USING GIN (to_tsvector('english', content));

-- Note: tsvector is computed on the fly in queries for now.
-- If search queries become hot, consider adding a generated tsvector column and indexing it:
--   ALTER TABLE citations ADD COLUMN text_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED;
--   CREATE INDEX idx_citations_text_tsv ON citations USING GIN (text_tsv);
