-- ============================================================================
-- Video Support Migration
-- ============================================================================
-- Adds channels and videos tables (mirrors shows and podcast_episodes pattern)
-- Adds transcript_source column for tracking transcription service used

-- ============================================================================
-- 1. Create channel_platform enum
-- ============================================================================
CREATE TYPE channel_platform AS ENUM ('youtube', 'vimeo');

-- ============================================================================
-- 2. Create channels table (mirrors shows table)
-- ============================================================================
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    platform channel_platform NOT NULL,
    platform_id TEXT NOT NULL,              -- YouTube channel ID (UC...) or Vimeo user ID
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,                     -- Channel avatar/thumbnail from platform
    subscriber_count INTEGER,
    video_count INTEGER,
    custom_url TEXT,                        -- e.g., @channelname for YouTube
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(platform, platform_id)
);

-- ============================================================================
-- 3. Create videos table (mirrors podcast_episodes table)
-- ============================================================================
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
    platform channel_platform NOT NULL,
    platform_id TEXT NOT NULL,              -- YouTube video ID (11 chars) or Vimeo video ID
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,                     -- Video thumbnail from platform
    duration INTEGER,                       -- Duration in seconds
    view_count BIGINT,

    -- Embed URL for player
    embed_url TEXT,                         -- e.g., https://www.youtube.com/embed/{id}

    -- Transcript status (path constructed dynamically: videos/{id}/transcript.json)
    transcript_status transcript_status NOT NULL DEFAULT 'none',
    transcript_error TEXT,
    transcript_source TEXT,                 -- 'youtube' or 'assemblyai'

    published_at TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(platform, platform_id)
);

-- ============================================================================
-- 4. Link sources to videos (user's "library")
-- ============================================================================
ALTER TABLE sources
ADD COLUMN video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. Update podcast_episodes table
-- ============================================================================
-- Add transcript_source column for consistency with videos
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS transcript_source TEXT DEFAULT 'assemblyai';

-- ============================================================================
-- 6. Indexes for channels
-- ============================================================================
CREATE INDEX idx_channels_platform ON channels(platform);
CREATE INDEX idx_channels_platform_id ON channels(platform, platform_id);
CREATE INDEX idx_channels_name ON channels(name);

-- ============================================================================
-- 7. Indexes for videos
-- ============================================================================
CREATE INDEX idx_videos_channel ON videos(channel_id);
CREATE INDEX idx_videos_platform ON videos(platform);
CREATE INDEX idx_videos_platform_id ON videos(platform, platform_id);
CREATE INDEX idx_videos_transcript_status ON videos(transcript_status) WHERE transcript_status != 'none';
CREATE INDEX idx_videos_published ON videos(published_at DESC);

-- ============================================================================
-- 8. Index for sources.video_id
-- ============================================================================
CREATE INDEX idx_sources_video ON sources(video_id);
