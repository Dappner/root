ALTER TABLE sources
ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';

UPDATE sources
SET status = CASE
    WHEN archived_at IS NOT NULL THEN 'completed'
    ELSE 'in_progress'
END;

ALTER TABLE sources
ADD CONSTRAINT sources_status_check CHECK (status IN ('in_progress', 'completed'));

CREATE INDEX idx_sources_user_id_status_updated_at
ON sources(user_id, status, updated_at DESC);
