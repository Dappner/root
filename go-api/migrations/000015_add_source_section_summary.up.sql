-- =========================
-- SOURCE SECTION SUMMARY
-- =========================

-- Add summary field for section summaries (embedded for RAG)
ALTER TABLE source_sections
  ADD COLUMN summary TEXT NULL,
  ADD COLUMN summary_sha256 CHAR(64) NULL;

-- Widen rag_embeddings.kind to support longer embedding types
ALTER TABLE rag_embeddings
  ALTER COLUMN kind TYPE VARCHAR(50);

-- Add check constraint for max length (1024 chars)
ALTER TABLE source_sections
  ADD CONSTRAINT chk_section_summary_length CHECK (summary IS NULL OR length(summary) <= 1024);

-- =========================
-- CLEANUP TRIGGER FOR SECTION SUMMARY EMBEDDINGS
-- =========================

-- Trigger function to delete section summary embeddings when section is deleted
CREATE OR REPLACE FUNCTION cleanup_source_section_summary_embeddings()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM rag_embeddings
    WHERE kind = 'source_section_summary' AND entity_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to source_sections table
CREATE TRIGGER trg_cleanup_source_section_summary_embeddings
AFTER DELETE ON source_sections
FOR EACH ROW
EXECUTE FUNCTION cleanup_source_section_summary_embeddings();
