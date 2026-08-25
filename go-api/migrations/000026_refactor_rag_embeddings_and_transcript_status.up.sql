-- =========================
-- TRANSCRIPT STATUS ENUM
-- =========================

-- Rename 'completed' -> 'transcribed', add 'embedded' as the terminal done state.
-- Pipeline: none -> pending -> transcribed -> embedded (or failed at any step)

ALTER TYPE transcript_status RENAME VALUE 'completed' TO 'transcribed';
ALTER TYPE transcript_status ADD VALUE IF NOT EXISTS 'embedded';

-- =========================
-- RAG EMBEDDINGS: ADD FK COLUMNS
-- =========================

-- Replace the (kind, entity_id) enum pattern with real foreign keys.
-- Exactly one of citation_id/capture_id/takeaway_id/section_id/source_id must be non-null.
-- source_id is used for transcript chunks (podcast, video, pdf, etc.) — any chunkable source.
-- chunk_index orders chunks within a source; NULL for all non-chunk types.

ALTER TABLE rag_embeddings
    ADD COLUMN citation_id  INTEGER REFERENCES citations(id)        ON DELETE CASCADE,
    ADD COLUMN capture_id   INTEGER REFERENCES captures(id)         ON DELETE CASCADE,
    ADD COLUMN takeaway_id  INTEGER REFERENCES source_takeaways(id) ON DELETE CASCADE,
    ADD COLUMN section_id   INTEGER REFERENCES source_sections(id)  ON DELETE CASCADE,
    ADD COLUMN source_id    INTEGER REFERENCES sources(id)          ON DELETE CASCADE,
    ADD COLUMN chunk_index  INTEGER;

-- =========================
-- BACKFILL FK COLUMNS FROM kind/entity_id
-- =========================

UPDATE rag_embeddings SET citation_id = entity_id WHERE kind = 'citation';
UPDATE rag_embeddings SET capture_id  = entity_id WHERE kind = 'capture';
UPDATE rag_embeddings SET takeaway_id = entity_id WHERE kind = 'takeaway';
UPDATE rag_embeddings SET section_id  = entity_id WHERE kind = 'source_section_summary';

-- =========================
-- ENFORCE EXACTLY-ONE-FK CONSTRAINT
-- =========================

ALTER TABLE rag_embeddings ADD CONSTRAINT chk_rag_embeddings_exactly_one_fk CHECK (
    (
        (citation_id IS NOT NULL)::int +
        (capture_id  IS NOT NULL)::int +
        (takeaway_id IS NOT NULL)::int +
        (section_id  IS NOT NULL)::int +
        (source_id   IS NOT NULL)::int
    ) = 1
);

-- =========================
-- DROP OLD UNIQUE CONSTRAINT AND INDEXES
-- =========================

ALTER TABLE rag_embeddings DROP CONSTRAINT rag_embeddings_kind_entity_id_key;
DROP INDEX IF EXISTS idx_rag_embeddings_content_hash;

-- =========================
-- NEW UNIQUE CONSTRAINTS
-- =========================

-- One embedding per non-chunk entity
ALTER TABLE rag_embeddings ADD CONSTRAINT uq_rag_embeddings_citation  UNIQUE (citation_id);
ALTER TABLE rag_embeddings ADD CONSTRAINT uq_rag_embeddings_capture   UNIQUE (capture_id);
ALTER TABLE rag_embeddings ADD CONSTRAINT uq_rag_embeddings_takeaway  UNIQUE (takeaway_id);
ALTER TABLE rag_embeddings ADD CONSTRAINT uq_rag_embeddings_section   UNIQUE (section_id);

-- Chunks are unique by (source_id, chunk_index); no unique on source_id alone
ALTER TABLE rag_embeddings ADD CONSTRAINT uq_rag_embeddings_source_chunk UNIQUE (source_id, chunk_index);

-- =========================
-- NEW INDEXES
-- =========================

CREATE INDEX idx_rag_embeddings_citation ON rag_embeddings (citation_id) WHERE citation_id IS NOT NULL;
CREATE INDEX idx_rag_embeddings_capture  ON rag_embeddings (capture_id)  WHERE capture_id  IS NOT NULL;
CREATE INDEX idx_rag_embeddings_takeaway ON rag_embeddings (takeaway_id) WHERE takeaway_id IS NOT NULL;
CREATE INDEX idx_rag_embeddings_section  ON rag_embeddings (section_id)  WHERE section_id  IS NOT NULL;
CREATE INDEX idx_rag_embeddings_source   ON rag_embeddings (source_id)   WHERE source_id   IS NOT NULL;
CREATE INDEX idx_rag_embeddings_content_hash ON rag_embeddings (content_sha256);

-- =========================
-- DROP OLD CLEANUP TRIGGERS AND FUNCTIONS
-- =========================

DROP TRIGGER IF EXISTS trg_cleanup_citation_embeddings               ON citations;
DROP TRIGGER IF EXISTS trg_cleanup_capture_embeddings                ON captures;
DROP TRIGGER IF EXISTS trg_cleanup_takeaway_embeddings               ON source_takeaways;
DROP TRIGGER IF EXISTS trg_cleanup_source_section_summary_embeddings ON source_sections;

DROP FUNCTION IF EXISTS cleanup_citation_embeddings();
DROP FUNCTION IF EXISTS cleanup_capture_embeddings();
DROP FUNCTION IF EXISTS cleanup_takeaway_embeddings();
DROP FUNCTION IF EXISTS cleanup_source_section_summary_embeddings();

-- =========================
-- DROP OLD COLUMNS
-- =========================

ALTER TABLE rag_embeddings DROP COLUMN kind;
ALTER TABLE rag_embeddings DROP COLUMN entity_id;
