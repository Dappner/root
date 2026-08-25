-- Shows table
CREATE TABLE shows (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    rss_feed_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,           -- RSS image URL (read from libsync)
    language TEXT,
    explicit BOOLEAN,
    categories JSONB,
    author TEXT,
    link TEXT,
    last_synced_at TIMESTAMP,  -- Track RSS sync freshness
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Podcast episodes with transcript storage
CREATE TYPE transcript_status AS ENUM ('none', 'pending', 'completed', 'failed');

CREATE TABLE podcast_episodes (
    id SERIAL PRIMARY KEY,
    show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    episode_guid TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    season INTEGER,
    episode_number INTEGER,
    duration INTEGER,

    -- Audio URL from RSS (read from libsync)
    enclosure_url TEXT,

    -- Transcript storage in R2 (shared by all users, Python writes this)
    transcript_status transcript_status NOT NULL DEFAULT 'none',
    transcript_error TEXT,

    -- Image URL from RSS (read from libsync)
    image_url TEXT,

    published_at TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(show_id, episode_guid)
);

-- Link sources to episodes (user's "library")
ALTER TABLE sources
ADD COLUMN episode_id INTEGER REFERENCES podcast_episodes(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_shows_title ON shows(title);
CREATE INDEX idx_shows_slug ON shows(slug);
CREATE INDEX idx_shows_last_synced ON shows(last_synced_at);

CREATE INDEX idx_podcast_episodes_show ON podcast_episodes(show_id);
CREATE INDEX idx_podcast_episodes_guid ON podcast_episodes(episode_guid);
CREATE INDEX idx_podcast_episodes_published ON podcast_episodes(published_at DESC);
CREATE INDEX idx_podcast_episodes_transcript_status ON podcast_episodes(transcript_status) WHERE transcript_status != 'none';

CREATE INDEX idx_sources_episode ON sources(episode_id);
