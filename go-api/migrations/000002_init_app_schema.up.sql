-- =========================
-- ENUMS
-- =========================

CREATE TYPE capture_status AS ENUM ('unfinished', 'finished');
CREATE TYPE info_type AS ENUM ('quote', 'stat', 'fact', 'paraphrase');
CREATE TYPE enrichment_status AS ENUM ('none', 'pending', 'completed', 'failed', 'cancelled');

-- =========================
-- SOURCES TABLE
-- =========================

CREATE TABLE sources (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES auth.user(id) NOT NULL,
    title VARCHAR(500),
    type VARCHAR(50) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    enrichment_status enrichment_status NOT NULL DEFAULT 'none',
    enrichment_error TEXT,
    summary_short TEXT,
    summary_long TEXT,
    last_active_at TIMESTAMP,
    archived_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_enrichment_pending ON sources(enrichment_status)
  WHERE enrichment_status = 'pending';
CREATE INDEX idx_sources_last_active ON sources(user_id, last_active_at DESC NULLS LAST)
  WHERE archived_at IS NULL;
CREATE INDEX idx_sources_archived ON sources(user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

-- =========================
-- SOURCE SECTIONS TABLE
-- =========================

CREATE TABLE source_sections (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES source_sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    range_start INTEGER,
    range_end INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_sections_source_order ON source_sections(source_id, order_index);
CREATE INDEX idx_source_sections_parent ON source_sections(parent_id);

-- =========================
-- CITATIONS TABLE
-- =========================

CREATE TABLE citations (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES auth.user(id) NOT NULL,
    info_type info_type NOT NULL,
    text TEXT NOT NULL,
    summary TEXT,
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    origin_source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    location JSONB,
    text_sha256 CHAR(64),
    section_id INTEGER REFERENCES source_sections(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_citations_user_id ON citations(user_id);
CREATE INDEX idx_citations_user_created ON citations(user_id, created_at DESC);
CREATE INDEX idx_citations_text_sha256 ON citations(user_id, text_sha256);
CREATE INDEX idx_citations_source_id ON citations(source_id);

-- =========================
-- CAPTURES TABLE
-- =========================

CREATE TABLE captures (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES auth.user(id) NOT NULL,
    citation_id INTEGER REFERENCES citations(id) ON DELETE SET NULL,
    status capture_status NOT NULL DEFAULT 'unfinished',
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    section_id INTEGER REFERENCES source_sections(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    summary TEXT,
    content_sha256 CHAR(64),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_captures_user_id ON captures(user_id);
CREATE INDEX idx_captures_source_id ON captures(source_id);
CREATE INDEX idx_captures_citation_id ON captures(citation_id);
CREATE INDEX idx_captures_status ON captures(status);
CREATE INDEX idx_captures_user_created ON captures(user_id, created_at DESC);
CREATE INDEX idx_captures_content_sha256 ON captures(content_sha256);
CREATE INDEX idx_captures_section_id ON captures(section_id);

-- =========================
-- TAGS TABLE
-- =========================

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES auth.user(id) NOT NULL,
    slug VARCHAR(64) NOT NULL,
    label VARCHAR(128) NOT NULL,
    color VARCHAR(16),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, slug)
);

CREATE INDEX idx_tags_user_id ON tags(user_id);

-- =========================
-- JUNCTIONS
-- =========================

CREATE TABLE capture_tags (
    capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (capture_id, tag_id)
);

CREATE INDEX idx_capture_tags_tag_id ON capture_tags(tag_id);

CREATE TABLE citation_tags (
    citation_id INTEGER NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (citation_id, tag_id)
);

CREATE INDEX idx_citation_tags_tag_id ON citation_tags(tag_id);

-- =========================
-- SOURCE TAKEAWAYS TABLES
-- =========================

CREATE TABLE source_takeaways (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth.user(id),
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_takeaways_source ON source_takeaways(source_id);
CREATE INDEX idx_source_takeaways_user ON source_takeaways(user_id);

CREATE TABLE source_takeaway_citations (
    takeaway_id INTEGER NOT NULL REFERENCES source_takeaways(id) ON DELETE CASCADE,
    citation_id INTEGER NOT NULL REFERENCES citations(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (takeaway_id, citation_id)
);

CREATE INDEX idx_takeaway_citations_citation ON source_takeaway_citations(citation_id);
CREATE INDEX idx_takeaway_citations_takeaway ON source_takeaway_citations(takeaway_id);

CREATE TABLE source_takeaway_captures (
    takeaway_id INTEGER NOT NULL REFERENCES source_takeaways(id) ON DELETE CASCADE,
    capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (takeaway_id, capture_id)
);

CREATE INDEX idx_takeaway_captures_capture ON source_takeaway_captures(capture_id);
CREATE INDEX idx_takeaway_captures_takeaway ON source_takeaway_captures(takeaway_id);

-- =========================
-- TRIGGERS
-- =========================

CREATE OR REPLACE FUNCTION prevent_source_type_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IS DISTINCT FROM OLD.type THEN
        RAISE EXCEPTION 'source type cannot be changed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_source_type_change
BEFORE UPDATE OF type ON sources
FOR EACH ROW
EXECUTE FUNCTION prevent_source_type_change();



-- Enrichment Cache
CREATE TABLE enrichment_cache (
  url TEXT PRIMARY KEY,
  title TEXT,
  site_name TEXT,
  author_name TEXT,
  description TEXT,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_enrichment_cache_last_fetched_at ON enrichment_cache(last_fetched_at);
