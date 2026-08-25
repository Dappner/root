CREATE TABLE collections (
    id         SERIAL PRIMARY KEY,
    user_id    TEXT        NOT NULL REFERENCES auth.user(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collections_user_id ON collections (user_id);

CREATE TABLE collection_sources (
    collection_id INTEGER   NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    source_id     INTEGER   NOT NULL REFERENCES sources (id) ON DELETE CASCADE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, source_id)
);

CREATE INDEX idx_collection_sources_source_id ON collection_sources (source_id);
