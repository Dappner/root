ARG PG_VERSION=17
FROM pgvector/pgvector:pg${PG_VERSION}

# Install pg_search (Neon/ParadeDB) extension
ARG PG_SEARCH_VERSION=0.20.5
ARG PG_MAJOR=17

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates libicu72 \
    && ARCH=$(dpkg --print-architecture) \
    && curl -L -o pg_search.deb "https://github.com/paradedb/paradedb/releases/download/v${PG_SEARCH_VERSION}/postgresql-${PG_MAJOR}-pg-search_${PG_SEARCH_VERSION}-1PARADEDB-bookworm_${ARCH}.deb" \
    && apt-get install -y ./pg_search.deb \
    && rm pg_search.deb \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# If you want to auto-enable extensions per database, drop SQL files into this directory
# as /docker-entrypoint-initdb.d/*.sql in a follow-up change.
