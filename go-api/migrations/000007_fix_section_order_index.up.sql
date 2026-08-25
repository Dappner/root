-- Fix order_index for existing sections
-- All sections currently have order_index = 0, which breaks sorting
-- This migration assigns sequential order_index values based on section ID

WITH ordered_sections AS (
  SELECT
    id,
    source_id,
    ROW_NUMBER() OVER (PARTITION BY source_id, parent_id ORDER BY id) - 1 AS new_order
  FROM source_sections
)
UPDATE source_sections ss
SET order_index = os.new_order
FROM ordered_sections os
WHERE ss.id = os.id;
