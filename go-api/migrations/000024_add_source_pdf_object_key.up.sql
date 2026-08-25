ALTER TABLE sources
    ADD COLUMN pdf_object_key TEXT;

UPDATE sources
SET pdf_object_key = 'user-buckets/' || user_id || '/pdfs/' || id || '/original.pdf'
WHERE type = 'pdf'
  AND pdf_object_key IS NULL;

CREATE INDEX idx_sources_pdf_object_key
    ON sources (pdf_object_key)
    WHERE pdf_object_key IS NOT NULL;
