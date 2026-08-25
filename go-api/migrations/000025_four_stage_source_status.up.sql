-- Drop old constraint
ALTER TABLE sources DROP CONSTRAINT sources_status_check;

-- Rename archived_at → completed_at
ALTER TABLE sources RENAME COLUMN archived_at TO completed_at;

-- Add new timestamp columns
ALTER TABLE sources ADD COLUMN started_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN reflecting_at TIMESTAMP;

-- Migrate existing data
-- completed → done, in_progress stays, set started_at from last_active_at where available
UPDATE sources
SET status = CASE
    WHEN status = 'completed' THEN 'done'
    WHEN status = 'in_progress' THEN 'in_progress'
    ELSE 'todo'
END,
started_at = CASE
    WHEN status = 'in_progress' THEN COALESCE(last_active_at, updated_at)
    ELSE NULL
END;

-- Change default for new sources to 'todo'
ALTER TABLE sources ALTER COLUMN status SET DEFAULT 'todo';

-- Add new constraint with 4 stages
ALTER TABLE sources ADD CONSTRAINT sources_status_check
    CHECK (status IN ('todo', 'in_progress', 'reflecting', 'done'));
