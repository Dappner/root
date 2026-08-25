ALTER TABLE notes
ADD COLUMN source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE;

CREATE INDEX idx_notes_user_id_source_id_updated_at
ON notes(user_id, source_id, updated_at DESC);
