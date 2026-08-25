ALTER TABLE notes
ADD COLUMN kind TEXT;

UPDATE notes
SET kind = 'note'
WHERE kind IS NULL OR kind = '';

ALTER TABLE notes
ALTER COLUMN kind SET DEFAULT 'note',
ALTER COLUMN kind SET NOT NULL;

ALTER TABLE notes
ADD CONSTRAINT notes_kind_check CHECK (kind IN ('note', 'insight'));
