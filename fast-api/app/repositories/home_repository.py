from collections.abc import Sequence

from sqlalchemy import text
from sqlalchemy.engine import RowMapping
from sqlalchemy.ext.asyncio import AsyncSession

_ACTIVITY_SQL = text(r"""
    WITH activity AS (
        SELECT
            'citation'::text AS activity_type,
            'source'::text AS activity_kind,
            ci.source_id AS source_id,
            NULL::integer AS note_id,
            ci.section_id AS section_id,
            ci.created_at AS ts
        FROM citations ci
        WHERE ci.user_id = :user_id
          AND ci.source_id IS NOT NULL

        UNION ALL

        SELECT
            'capture'::text AS activity_type,
            'source'::text AS activity_kind,
            cap.source_id AS source_id,
            NULL::integer AS note_id,
            cap.section_id AS section_id,
            cap.created_at AS ts
        FROM captures cap
        WHERE cap.user_id = :user_id
          AND cap.source_id IS NOT NULL
          AND cap.deleted_at IS NULL

        UNION ALL

        SELECT
            'takeaway'::text AS activity_type,
            'source'::text AS activity_kind,
            st.source_id AS source_id,
            NULL::integer AS note_id,
            NULL::integer AS section_id,
            st.updated_at AS ts
        FROM source_takeaways st
        WHERE st.user_id = :user_id

        UNION ALL

        SELECT
            'note'::text AS activity_type,
            'source'::text AS activity_kind,
            n.source_id AS source_id,
            NULL::integer AS note_id,
            NULL::integer AS section_id,
            n.updated_at AS ts
        FROM notes n
        WHERE n.user_id = :user_id
          AND n.source_id IS NOT NULL

        UNION ALL

        SELECT
            'note'::text AS activity_type,
            'note'::text AS activity_kind,
            NULL::integer AS source_id,
            n.id AS note_id,
            NULL::integer AS section_id,
            n.updated_at AS ts
        FROM notes n
        WHERE n.user_id = :user_id
          AND n.source_id IS NULL
    ),
    ranked AS (
        SELECT DISTINCT ON (activity_kind, COALESCE(source_id::text, 'note:' || note_id::text))
            activity_type,
            activity_kind,
            source_id,
            note_id,
            section_id,
            ts
        FROM activity
        ORDER BY activity_kind,
                 COALESCE(source_id::text, 'note:' || note_id::text),
                 ts DESC
    ),
    top5 AS (
        SELECT *
        FROM ranked
        ORDER BY ts DESC
        LIMIT 5
    )
    SELECT
        t.activity_type,
        t.activity_kind,
        t.source_id,
        t.note_id,
        t.section_id,
        t.ts AS last_activity_at,
        s.id AS s_id,
        s.title AS s_title,
        s.type AS s_type,
        s.status AS s_status,
        s.author AS s_author,
        s.label AS s_label,
        s.metadata AS s_metadata,
        s.summary_short AS s_summary_short,
        s.summary_long AS s_summary_long,
        s.published_at AS s_published_at,
        s.last_active_at AS s_last_active_at,
        s.completed_at AS s_completed_at,
        s.episode_id AS s_episode_id,
        s.video_id AS s_video_id,
        s.created_at AS s_created_at,
        s.updated_at AS s_updated_at,
        pe.title AS pe_title,
        pe.duration AS pe_duration,
        pe.enclosure_url AS pe_enclosure_url,
        pe.image_url AS pe_image_url,
        v.platform AS v_platform,
        v.platform_id AS v_platform_id,
        v.thumbnail_url AS v_thumbnail_url,
        v.duration AS v_duration,
        v.embed_url AS v_embed_url,
        COUNT(DISTINCT cap.id)::INTEGER AS s_capture_count,
        COUNT(DISTINCT ci.id)::INTEGER AS s_citation_count,
        COUNT(DISTINCT st.id)::INTEGER AS s_takeaway_count,
        COALESCE(
            array_agg(DISTINCT stg.tag_id) FILTER (WHERE stg.tag_id IS NOT NULL),
            ARRAY[]::int[]
        )::int[] AS s_tag_ids,
        ss.title AS section_title,
        n.id AS n_id,
        n.title AS n_title,
        n.kind AS n_kind,
        n.updated_at AS n_updated_at,
        CASE
            WHEN n.id IS NULL THEN NULL
            WHEN length(n.plain_text) <= 500 THEN n.plain_text
            ELSE '…' || right(n.plain_text, 500)
        END AS n_preview,
        CASE
            WHEN n.id IS NULL THEN 0
            WHEN length(btrim(n.plain_text)) = 0 THEN 0
            ELSE array_length(regexp_split_to_array(btrim(n.plain_text), '\s+'), 1)
        END AS n_word_count,
        COALESCE(
            (SELECT COUNT(*) FROM note_citations nc WHERE nc.note_id = n.id),
            0
        ) AS n_citation_count
    FROM top5 t
    LEFT JOIN sources s ON s.id = t.source_id
    LEFT JOIN captures cap ON cap.source_id = s.id
    LEFT JOIN citations ci ON ci.source_id = s.id
    LEFT JOIN source_takeaways st ON st.source_id = s.id
    LEFT JOIN source_tags stg ON stg.source_id = s.id
    LEFT JOIN source_sections ss ON ss.id = t.section_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN notes n ON n.id = t.note_id
    WHERE (t.activity_kind = 'source' AND s.status != 'done' AND s.completed_at IS NULL)
       OR (t.activity_kind = 'note')
    GROUP BY
        t.activity_type, t.activity_kind, t.source_id, t.note_id,
        t.section_id, t.ts,
        s.id, s.title, s.type, s.status, s.author, s.label, s.metadata,
        s.summary_short, s.summary_long, s.published_at, s.last_active_at,
        s.completed_at, s.episode_id, s.video_id, s.created_at, s.updated_at,
        pe.title, pe.duration, pe.enclosure_url, pe.image_url,
        v.platform, v.platform_id, v.thumbnail_url, v.duration, v.embed_url,
        ss.title,
        n.id, n.title, n.kind, n.updated_at
    ORDER BY t.ts DESC
    """)

_RECENT_HIGHLIGHTS_SQL = text("""
    WITH highlights AS (
        SELECT
            'citation'::text AS kind,
            ci.id AS id,
            ci.source_id AS source_id,
            ci.section_id AS section_id,
            ci.text AS text,
            NULL::text AS summary,
            ci.info_type::text AS info_type,
            ci.created_at AS created_at,
            ci.updated_at AS updated_at
        FROM citations ci
        WHERE ci.user_id = :user_id

        UNION ALL

        SELECT
            'capture'::text AS kind,
            cap.id AS id,
            cap.source_id AS source_id,
            cap.section_id AS section_id,
            cap.content AS text,
            cap.summary AS summary,
            ''::text AS info_type,
            cap.created_at AS created_at,
            cap.updated_at AS updated_at
        FROM captures cap
        WHERE cap.user_id = :user_id
          AND cap.deleted_at IS NULL
    )
    SELECT
        h.kind,
        h.id,
        h.source_id,
        s.title AS source_title,
        s.type AS source_type,
        h.section_id,
        ss.title AS section_title,
        h.text,
        h.summary,
        h.info_type,
        h.created_at,
        h.updated_at
    FROM highlights h
    LEFT JOIN sources s ON s.id = h.source_id
    LEFT JOIN source_sections ss ON ss.id = h.section_id
    ORDER BY h.created_at DESC
    LIMIT 8
    """)


_RECENT_TAKEAWAYS_SQL = text("""
    SELECT
        st.id,
        st.user_id,
        st.title,
        st.body,
        st.body_json,
        st.content_sha256,
        st.created_at,
        st.updated_at,
        s.id AS source_id,
        s.title AS source_title,
        s.type AS source_type,
        pe.image_url AS pe_image_url,
        v.thumbnail_url AS v_thumbnail_url
    FROM source_takeaways st
    JOIN sources s ON s.id = st.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN videos v ON v.id = s.video_id
    WHERE st.user_id = :user_id
    ORDER BY st.updated_at DESC
    LIMIT 3
    """)

_PICKUP_NOTES_SQL = text(r"""
    SELECT
        n.id,
        n.title,
        n.kind,
        n.updated_at,
        CASE
            WHEN length(n.plain_text) <= 160 THEN n.plain_text
            ELSE substr(n.plain_text, 1, 160) || '…'
        END AS preview,
        CASE
            WHEN length(btrim(n.plain_text)) = 0 THEN 0
            ELSE array_length(regexp_split_to_array(btrim(n.plain_text), '\s+'), 1)
        END AS word_count
    FROM notes n
    WHERE n.user_id = :user_id
    ORDER BY n.updated_at DESC
    LIMIT 3
    """)

_RECENTLY_CAPTURED_SQL = text("""
    WITH highlight_activity AS (
        SELECT
            source_id,
            MAX(ts) AS captured_at
        FROM (
            SELECT
                ci.source_id AS source_id,
                GREATEST(ci.created_at, ci.updated_at) AS ts
            FROM citations ci
            WHERE ci.user_id = :user_id
              AND ci.source_id IS NOT NULL

            UNION ALL

            SELECT
                cap.source_id AS source_id,
                GREATEST(cap.created_at, cap.updated_at) AS ts
            FROM captures cap
            WHERE cap.user_id = :user_id
              AND cap.source_id IS NOT NULL
              AND cap.deleted_at IS NULL
        ) a
        GROUP BY source_id
    ),
    top_sources AS (
        SELECT source_id, captured_at
        FROM highlight_activity
        ORDER BY captured_at DESC
        LIMIT 6
    )
    SELECT
        ts.captured_at AS captured_at,
        s.id AS s_id,
        s.title AS s_title,
        s.type AS s_type,
        s.status AS s_status,
        s.author AS s_author,
        s.label AS s_label,
        s.metadata AS s_metadata,
        s.summary_short AS s_summary_short,
        s.summary_long AS s_summary_long,
        s.published_at AS s_published_at,
        s.last_active_at AS s_last_active_at,
        s.completed_at AS s_completed_at,
        s.episode_id AS s_episode_id,
        s.video_id AS s_video_id,
        s.created_at AS s_created_at,
        s.updated_at AS s_updated_at,
        pe.title AS pe_title,
        pe.duration AS pe_duration,
        pe.enclosure_url AS pe_enclosure_url,
        pe.image_url AS pe_image_url,
        v.platform AS v_platform,
        v.platform_id AS v_platform_id,
        v.thumbnail_url AS v_thumbnail_url,
        v.duration AS v_duration,
        v.embed_url AS v_embed_url,
        COUNT(DISTINCT cap.id)::INTEGER AS s_capture_count,
        COUNT(DISTINCT ci.id)::INTEGER AS s_citation_count,
        COUNT(DISTINCT st.id)::INTEGER AS s_takeaway_count,
        COALESCE(
            array_agg(DISTINCT stg.tag_id) FILTER (WHERE stg.tag_id IS NOT NULL),
            ARRAY[]::int[]
        )::int[] AS s_tag_ids
    FROM top_sources ts
    JOIN sources s ON s.id = ts.source_id
    LEFT JOIN podcast_episodes pe ON pe.id = s.episode_id
    LEFT JOIN videos v ON v.id = s.video_id
    LEFT JOIN captures cap ON cap.source_id = s.id AND cap.deleted_at IS NULL
    LEFT JOIN citations ci ON ci.source_id = s.id
    LEFT JOIN source_takeaways st ON st.source_id = s.id
    LEFT JOIN source_tags stg ON stg.source_id = s.id
    WHERE s.user_id = :user_id
    GROUP BY
        ts.captured_at,
        s.id, pe.title, pe.duration, pe.enclosure_url, pe.image_url,
        v.platform, v.platform_id, v.thumbnail_url, v.duration, v.embed_url
    ORDER BY ts.captured_at DESC
    """)


class HomeRepository:
    async def get_activity_rows(self, db: AsyncSession, user_id: str) -> Sequence[RowMapping]:
        result = await db.execute(_ACTIVITY_SQL, {"user_id": user_id})
        return result.mappings().all()

    async def get_recent_highlight_rows(
        self, db: AsyncSession, user_id: str
    ) -> Sequence[RowMapping]:
        result = await db.execute(_RECENT_HIGHLIGHTS_SQL, {"user_id": user_id})
        return result.mappings().all()

    async def get_recent_takeaway_rows(
        self, db: AsyncSession, user_id: str
    ) -> Sequence[RowMapping]:
        result = await db.execute(_RECENT_TAKEAWAYS_SQL, {"user_id": user_id})
        return result.mappings().all()

    async def get_pickup_note_rows(self, db: AsyncSession, user_id: str) -> Sequence[RowMapping]:
        result = await db.execute(_PICKUP_NOTES_SQL, {"user_id": user_id})
        return result.mappings().all()

    async def get_recently_captured_rows(
        self, db: AsyncSession, user_id: str
    ) -> Sequence[RowMapping]:
        result = await db.execute(_RECENTLY_CAPTURED_SQL, {"user_id": user_id})
        return result.mappings().all()
