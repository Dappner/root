-- ============================================================================
-- Migration 000015: Remove Deprecated Columns and Tables
-- ============================================================================
-- This migration removes unused columns and tables to simplify the schema:
-- - captures.status (capture_status enum)
-- - citations.origin_source_id
-- - source_sections.parent_id and source_sections.kind
-- - sources.enrichment_status and sources.enrichment_error
-- - enrichment_cache table (entire table)
-- ============================================================================

-- ============================================================================
-- 1. Drop captures.status column and capture_status enum
-- ============================================================================
-- Remove status column from captures table (not currently used)
ALTER TABLE captures DROP COLUMN IF EXISTS status;

-- Drop the capture_status enum type (no longer needed)
DROP TYPE IF EXISTS capture_status;

-- Drop associated index if it exists
DROP INDEX IF EXISTS idx_captures_status;

-- ============================================================================
-- 2. Drop citations.origin_source_id column
-- ============================================================================
-- Remove origin_source_id column (not currently used)
ALTER TABLE citations DROP COLUMN IF EXISTS origin_source_id;

-- ============================================================================
-- 3. Drop source_sections parent_id and kind columns
-- ============================================================================
-- Remove parent_id column (hierarchical sections not currently used)
ALTER TABLE source_sections DROP COLUMN IF EXISTS parent_id;

-- Drop associated index
DROP INDEX IF EXISTS idx_source_sections_parent;

-- Remove kind column (not currently used)
ALTER TABLE source_sections DROP COLUMN IF EXISTS kind;

-- ============================================================================
-- 4. Drop sources enrichment columns
-- ============================================================================
-- Remove enrichment_status column (deprecated feature)
ALTER TABLE sources DROP COLUMN IF EXISTS enrichment_status;

-- Remove enrichment_error column (deprecated feature)
ALTER TABLE sources DROP COLUMN IF EXISTS enrichment_error;

-- Drop associated index
DROP INDEX IF EXISTS idx_sources_enrichment_pending;

-- Drop the enrichment_status enum type (no longer needed)
DROP TYPE IF EXISTS enrichment_status;

-- ============================================================================
-- 5. Drop enrichment_cache table entirely
-- ============================================================================
-- Drop the entire enrichment_cache table (pre-emptive optimization for underused feature)
DROP TABLE IF EXISTS enrichment_cache;
