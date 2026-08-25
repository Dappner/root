ALTER TABLE source_sections
    ADD COLUMN generated_by TEXT NOT NULL DEFAULT 'user'
        CHECK (generated_by IN ('user', 'auto'));

CREATE INDEX idx_source_sections_source_generated
    ON source_sections (source_id, generated_by);
