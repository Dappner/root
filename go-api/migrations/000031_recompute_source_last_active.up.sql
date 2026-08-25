-- Recompute sources.last_active_at as the most recent moment of *intentional knowledge work*
-- on the source: a capture, citation, or takeaway create/update.
--
-- Previously the column was also bumped by:
--   - playback progress ticks (every 10s) in fast-api
--   - GET /sources/{id} detail loads in go-api
-- Both have been removed. This migration overwrites legacy values that were
-- inflated by those noisy writes.
--
-- The column is preserved (semantics tightened, name unchanged).

WITH engagement AS (
    SELECT
        s.id AS source_id,
        GREATEST(
            COALESCE((SELECT MAX(updated_at) FROM captures        WHERE source_id = s.id), 'epoch'::timestamp),
            COALESCE((SELECT MAX(updated_at) FROM citations       WHERE source_id = s.id), 'epoch'::timestamp),
            COALESCE((SELECT MAX(updated_at) FROM source_takeaways WHERE source_id = s.id), 'epoch'::timestamp)
        ) AS engaged_at
    FROM sources s
)
UPDATE sources s
SET last_active_at = e.engaged_at
FROM engagement e
WHERE s.id = e.source_id
  AND e.engaged_at > 'epoch'::timestamp;

-- Clear last_active_at for sources with zero engagement so "Recently worked on"
-- never surfaces a source you've only viewed.
UPDATE sources s
SET last_active_at = NULL
WHERE NOT EXISTS (SELECT 1 FROM captures        WHERE source_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM citations       WHERE source_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM source_takeaways WHERE source_id = s.id);
