-- ============================================================================
-- Migration 000010: Add Review System (Spaced Repetition with AI Generation)
-- ============================================================================
-- DEPENDS ON: source_takeaways(id, user_id, source_id)
--             citations(id, user_id, source_id)
-- IF THESE SCHEMAS CHANGE, UPDATE validate_polymorphic_reference_v1() TRIGGER
-- ============================================================================

-- ENUMs for type safety
CREATE TYPE review_state AS ENUM ('new', 'learning', 'review', 'suspended');
CREATE TYPE review_type_enum AS ENUM ('qa', 'quote_recall');  -- reflection deferred to Phase 2
CREATE TYPE item_type_enum AS ENUM ('takeaway', 'citation', 'idea');
CREATE TYPE suggestion_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE review_outcome AS ENUM ('forgot', 'hard', 'good', 'easy');

-- ============================================================================
-- Core review items (what goes into SRS rotation)
-- ============================================================================
CREATE TABLE review_items (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,

    -- Polymorphic reference to source content (validated via triggers)
    item_type item_type_enum NOT NULL,
    item_id INTEGER NOT NULL,         -- FK to source_takeaways, citations, or ideas (future)

    -- Review content (AI-customized prompts/answers)
    prompt TEXT NOT NULL,
    prompt_sha256 CHAR(64) NOT NULL,  -- For deduplication
    answer TEXT,
    answer_sha256 CHAR(64),           -- For deduplication (nullable for future reflection type)
    review_type review_type_enum NOT NULL,

    -- Metadata (typed JSONB - see extraction functions below)
    metadata JSONB NOT NULL DEFAULT '{}',  -- {"difficulty": "easy|medium|hard"}

    -- Links (source_id auto-set by trigger from referenced item)
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    idea_id INTEGER,                  -- Future: link to cross-source topics/ideas

    -- SM-2 scheduling state
    state review_state NOT NULL DEFAULT 'new',
    introduced_at TIMESTAMPTZ,        -- When item entered "learning" (null if still new)
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 day',
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,     -- When item was last reviewed (for priority calculation)

    suspended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique on hash (not raw prompt) for stable deduplication
    UNIQUE (user_id, item_type, item_id, prompt_sha256)
);

-- ============================================================================
-- AI-generated suggestions awaiting user approval
-- ============================================================================
CREATE TABLE review_suggestions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

    -- Suggested content (validated via trigger before insert)
    item_type item_type_enum NOT NULL,
    item_id INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    prompt_sha256 CHAR(64) NOT NULL,
    answer TEXT,
    answer_sha256 CHAR(64),
    review_type review_type_enum NOT NULL,
    reasoning TEXT,

    -- Metadata (typed JSONB)
    metadata JSONB NOT NULL DEFAULT '{}',  -- {"difficulty": "easy|medium|hard"}

    status suggestion_status NOT NULL DEFAULT 'pending',
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique on hash for idempotent regeneration
    UNIQUE (user_id, item_type, item_id, prompt_sha256)
);

-- ============================================================================
-- Review history (MVP: only recall outcomes, no reflection yet)
-- ============================================================================
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
    review_item_id INTEGER NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
    outcome review_outcome NOT NULL,  -- forgot, hard, good, easy (reflection deferred)
    time_taken_ms INTEGER,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX idx_review_items_user_due ON review_items(user_id, due_at)
    WHERE state != 'suspended';
CREATE INDEX idx_review_items_user_new ON review_items(user_id, created_at)
    WHERE state = 'new';  -- For "new items waiting" query
CREATE INDEX idx_review_items_source ON review_items(source_id)
    WHERE source_id IS NOT NULL;
CREATE INDEX idx_review_items_idea ON review_items(idea_id)
    WHERE idea_id IS NOT NULL;  -- Future: idea clustering
CREATE INDEX idx_review_suggestions_user_pending ON review_suggestions(user_id, source_id)
    WHERE status = 'pending';
CREATE INDEX idx_reviews_item_time ON reviews(review_item_id, reviewed_at DESC);
CREATE INDEX idx_reviews_user_reviewed ON reviews(user_id, reviewed_at DESC);

-- ============================================================================
-- Validation trigger function (versioned explicitly)
-- ============================================================================
-- Purpose: Enforce referential integrity for polymorphic (item_type, item_id) pairs
-- Version 1: Initial polymorphic validation
-- DEPENDS ON: source_takeaways(id, user_id, source_id)
--             citations(id, user_id, source_id)
-- IF THESE SCHEMAS CHANGE (rename, soft delete, etc), UPDATE THIS TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_polymorphic_reference_v1() RETURNS TRIGGER AS $$
DECLARE
    found_source_id INTEGER;
BEGIN
    -- 1. Validate reference exists and belongs to user
    IF NEW.item_type = 'takeaway' THEN
        SELECT source_id INTO found_source_id
        FROM source_takeaways
        WHERE id = NEW.item_id AND user_id = NEW.user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid takeaway reference or user mismatch';
        END IF;

        NEW.source_id := found_source_id;

    ELSIF NEW.item_type = 'citation' THEN
        SELECT source_id INTO found_source_id
        FROM citations
        WHERE id = NEW.item_id AND user_id = NEW.user_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid citation reference or user mismatch';
        END IF;

        NEW.source_id := found_source_id;

    ELSIF NEW.item_type = 'idea' THEN
        -- Future: validate against ideas table
        RAISE EXCEPTION 'Idea item type not yet supported';

    ELSE
        RAISE EXCEPTION 'Invalid item_type: %', NEW.item_type;
    END IF;

    -- 2. Auto-set source_id from referenced item (prevents drift)
    -- Already done in SELECT above

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Attach triggers to tables
-- ============================================================================
CREATE TRIGGER validate_review_item_reference
    BEFORE INSERT OR UPDATE ON review_items
    FOR EACH ROW EXECUTE FUNCTION validate_polymorphic_reference_v1();

CREATE TRIGGER validate_review_suggestion_reference
    BEFORE INSERT OR UPDATE ON review_suggestions
    FOR EACH ROW EXECUTE FUNCTION validate_polymorphic_reference_v1();
