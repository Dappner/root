-- =============================================================================
-- NOTES
-- =============================================================================

CREATE TABLE notes (
    id         SERIAL PRIMARY KEY,
    user_id    TEXT        NOT NULL REFERENCES auth.user(id),
    title      TEXT        NOT NULL DEFAULT '',
    body       JSONB       NOT NULL DEFAULT '{}',
    plain_text TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);

-- =============================================================================
-- NOTE REFERENCE JOIN TABLES
-- =============================================================================

CREATE TABLE note_citations (
    note_id     INTEGER NOT NULL REFERENCES notes(id)     ON DELETE CASCADE,
    citation_id INTEGER NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, citation_id)
);

CREATE INDEX idx_note_citations_citation_id ON note_citations(citation_id);
