-- Enable pg_search (BM25) extension
CREATE EXTENSION IF NOT EXISTS pg_search;

-- BM25 indexes for citations and captures
-- pg_search requires a unique key field to be part of the index configuration
CREATE INDEX IF NOT EXISTS idx_citations_text_bm25 ON citations USING bm25 (id, text) WITH (key_field='id');
CREATE INDEX IF NOT EXISTS idx_captures_content_bm25 ON captures USING bm25 (id, content) WITH (key_field='id');
