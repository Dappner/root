ALTER TABLE sources ADD COLUMN label VARCHAR(100);
CREATE INDEX idx_sources_label ON sources(label);

CREATE TABLE source_tags (
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (source_id, tag_id)
);
CREATE INDEX idx_source_tags_tag_id ON source_tags(tag_id);

-- Cleanup deprecated tag junctions
DROP TABLE IF EXISTS capture_tags;
DROP TABLE IF EXISTS citation_tags;
