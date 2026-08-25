-- ============================================================================
-- Voice suggestions
-- ============================================================================
-- Durable review queue for mobile voice notes captured while listening.
-- FastAPI owns processing and approval for v1, but the shared schema lives here.

CREATE TYPE suggestion_origin_enum AS ENUM ('mobile_voice');

CREATE TYPE suggestion_processing_status AS ENUM (
    'uploaded',
    'processing',
    'ready',
    'failed',
    'approved',
    'dismissed'
);

CREATE TYPE suggestion_action_enum AS ENUM (
    'create_citation',
    'create_capture',
    'create_citation_with_capture',
    'uncertain'
);

CREATE TABLE suggestions (
    id SERIAL PRIMARY KEY,
    client_id TEXT UNIQUE,
    user_id TEXT NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    episode_id INTEGER REFERENCES podcast_episodes(id) ON DELETE SET NULL,

    origin suggestion_origin_enum NOT NULL DEFAULT 'mobile_voice',
    status suggestion_processing_status NOT NULL DEFAULT 'uploaded',
    suggested_action suggestion_action_enum,

    playback_position_seconds NUMERIC,
    recorded_at TIMESTAMPTZ,

    audio_r2_key TEXT,
    voice_transcript TEXT,

    suggested_payload JSONB,
    processing_metadata JSONB NOT NULL DEFAULT '{}',
    error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_suggestions_user_source_status
    ON suggestions(user_id, source_id, status, created_at DESC);

CREATE INDEX idx_suggestions_user_status
    ON suggestions(user_id, status, created_at DESC);

CREATE INDEX idx_suggestions_source_created
    ON suggestions(source_id, created_at DESC);
