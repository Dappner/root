-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================
-- RAG EMBEDDINGS TABLE
-- =========================

-- Stores vector embeddings for citations and captures
-- No foreign keys - embeddings are derived data that can be regenerated
CREATE TABLE rag_embeddings (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL,              -- 'citation' or 'capture'
    entity_id INTEGER NOT NULL,             -- References citations.id or captures.id (no FK constraint)
    content_sha256 CHAR(64) NOT NULL,       -- Content hash at time of embedding generation
    embedding vector(1024) NOT NULL,        -- Vector embedding (1024 dims for voyage-3, 512 for voyage-3-lite)
    model VARCHAR(100) NOT NULL,            -- Model name: 'voyage-3', 'voyage-3-lite', etc.
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Unique constraint: one embedding per entity
    UNIQUE (kind, entity_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_rag_embeddings_content_hash ON rag_embeddings(kind, content_sha256);

-- =========================
-- CLEANUP TRIGGERS
-- =========================

-- Trigger function to delete citation embeddings when citation is deleted
CREATE OR REPLACE FUNCTION cleanup_citation_embeddings()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM rag_embeddings
    WHERE kind = 'citation' AND entity_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to delete capture embeddings when capture is deleted
CREATE OR REPLACE FUNCTION cleanup_capture_embeddings()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM rag_embeddings
    WHERE kind = 'capture' AND entity_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to cascade delete embeddings
CREATE TRIGGER trg_cleanup_citation_embeddings
AFTER DELETE ON citations
FOR EACH ROW
EXECUTE FUNCTION cleanup_citation_embeddings();

CREATE TRIGGER trg_cleanup_capture_embeddings
AFTER DELETE ON captures
FOR EACH ROW
EXECUTE FUNCTION cleanup_capture_embeddings();
