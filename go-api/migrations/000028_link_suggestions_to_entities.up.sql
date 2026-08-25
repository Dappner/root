ALTER TABLE citations
    ADD COLUMN suggestion_id INTEGER REFERENCES suggestions(id) ON DELETE SET NULL;

ALTER TABLE captures
    ADD COLUMN suggestion_id INTEGER REFERENCES suggestions(id) ON DELETE SET NULL;

CREATE INDEX idx_citations_suggestion_id ON citations(suggestion_id) WHERE suggestion_id IS NOT NULL;
CREATE INDEX idx_captures_suggestion_id ON captures(suggestion_id) WHERE suggestion_id IS NOT NULL;
