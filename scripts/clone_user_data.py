#!/usr/bin/env python3
"""Clone a single user's data from remote to local database."""

import argparse
import os
import sys
from pathlib import Path
from typing import Optional
import asyncio
import asyncpg
from asyncpg import exceptions
from dotenv import load_dotenv


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)


async def clone_user_data(
    remote_url: str,
    local_url: str,
    remote_user_id: str,
    local_user_id: Optional[str],
    *,
    use_local_admin: bool = False,
    local_admin_email: str = "admin@example.com",
):
    """Clone all data for one user from remote to local."""

    # Connect to databases
    remote_conn = await asyncpg.connect(remote_url)
    local_conn = await asyncpg.connect(local_url)

    try:
        if use_local_admin:
            local_user_id = await local_conn.fetchval(
                "SELECT id FROM auth.user WHERE email = $1", local_admin_email
            )
            if not local_user_id:
                print(
                    f"Error: Local admin user with email {local_admin_email} doesn't exist",
                    file=sys.stderr,
                )
                return

        if not local_user_id:
            print("Error: Local user ID is required", file=sys.stderr)
            return

        # ID mappings
        source_map: dict[int, int] = {}  # remote_id -> local_id
        citation_map: dict[int, int] = {}
        capture_map: dict[int, int] = {}
        tag_map: dict[int, int] = {}
        section_map: dict[int, int] = {}
        takeaway_map: dict[int, int] = {}
        show_map: dict[int, int] = {}
        episode_map: dict[int, int] = {}
        channel_map: dict[int, int] = {}
        video_map: dict[int, int] = {}
        note_map: dict[int, int] = {}
        suggestion_map: dict[int, int] = {}

        print(f"🔄 Cloning user {remote_user_id} → {local_user_id}")

        # Check local user exists
        local_user_exists = await local_conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM auth.user WHERE id = $1)", local_user_id
        )
        if not local_user_exists:
            print(f"Error: Local user {local_user_id} doesn't exist", file=sys.stderr)
            print("Create it first: make seed-db", file=sys.stderr)
            return

        # 0. Shows & Episodes (preserve IDs for R2 transcript path compatibility)
        print("📦 Cloning shows and episodes referenced by user sources...")
        remote_sources = await remote_conn.fetch(
            "SELECT DISTINCT episode_id FROM sources WHERE user_id = $1 AND episode_id IS NOT NULL",
            remote_user_id,
        )
        remote_episode_ids = [r["episode_id"] for r in remote_sources]

        if remote_episode_ids:
            remote_episodes = await remote_conn.fetch(
                "SELECT * FROM podcast_episodes WHERE id = ANY($1)", remote_episode_ids
            )
            remote_show_ids = list(set(r["show_id"] for r in remote_episodes))

            if remote_show_ids:
                remote_shows = await remote_conn.fetch(
                    "SELECT * FROM shows WHERE id = ANY($1)", remote_show_ids
                )
                for show in remote_shows:
                    # Check if show with this ID already exists
                    existing = await local_conn.fetchval(
                        "SELECT id FROM shows WHERE id = $1", show["id"]
                    )
                    if existing:
                        # Update existing show
                        await local_conn.execute(
                            """UPDATE shows SET slug = $2, rss_feed_url = $3, title = $4, description = $5,
                               image_url = $6, language = $7, explicit = $8, categories = $9, author = $10,
                               link = $11, last_synced_at = $12, metadata = $13, updated_at = $14
                               WHERE id = $1""",
                            show["id"],
                            show["slug"],
                            show["rss_feed_url"],
                            show["title"],
                            show["description"],
                            show["image_url"],
                            show["language"],
                            show["explicit"],
                            show["categories"],
                            show["author"],
                            show["link"],
                            show["last_synced_at"],
                            show["metadata"],
                            show["updated_at"],
                        )
                        show_map[show["id"]] = show["id"]
                    else:
                        # Insert with explicit ID to preserve remote ID
                        await local_conn.execute(
                            """INSERT INTO shows (id, slug, rss_feed_url, title, description, image_url,
                               language, explicit, categories, author, link, last_synced_at, metadata, created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)""",
                            show["id"],
                            show["slug"],
                            show["rss_feed_url"],
                            show["title"],
                            show["description"],
                            show["image_url"],
                            show["language"],
                            show["explicit"],
                            show["categories"],
                            show["author"],
                            show["link"],
                            show["last_synced_at"],
                            show["metadata"],
                            show["created_at"],
                            show["updated_at"],
                        )
                        show_map[show["id"]] = show["id"]

                # Update sequence to avoid ID conflicts on future inserts
                max_show_id = max(s["id"] for s in remote_shows)
                await local_conn.execute(
                    f"SELECT setval('shows_id_seq', GREATEST((SELECT MAX(id) FROM shows), {max_show_id}))"
                )
                print(f"  ✅ {len(remote_shows)} shows (IDs preserved)")

            for ep in remote_episodes:
                # Check if episode with this ID already exists
                existing = await local_conn.fetchval(
                    "SELECT id FROM podcast_episodes WHERE id = $1", ep["id"]
                )
                if existing:
                    # Update existing episode
                    await local_conn.execute(
                        """UPDATE podcast_episodes SET show_id = $2, episode_guid = $3, title = $4,
                           description = $5, season = $6, episode_number = $7, duration = $8,
                           enclosure_url = $9, transcript_status = $10, transcript_error = $11,
                           image_url = $12, published_at = $13, metadata = $14, updated_at = $15,
                           transcript_source = $16
                           WHERE id = $1""",
                        ep["id"],
                        show_map[ep["show_id"]],
                        ep["episode_guid"],
                        ep["title"],
                        ep["description"],
                        ep["season"],
                        ep["episode_number"],
                        ep["duration"],
                        ep["enclosure_url"],
                        ep["transcript_status"],
                        ep["transcript_error"],
                        ep["image_url"],
                        ep["published_at"],
                        ep["metadata"],
                        ep["updated_at"],
                        ep.get("transcript_source"),
                    )
                    episode_map[ep["id"]] = ep["id"]
                else:
                    # Insert with explicit ID to preserve remote ID (critical for R2 paths!)
                    await local_conn.execute(
                        """INSERT INTO podcast_episodes (id, show_id, episode_guid, title, description, season,
                           episode_number, duration, enclosure_url, transcript_status,
                           transcript_error, image_url, published_at, metadata, created_at, updated_at,
                           transcript_source)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)""",
                        ep["id"],
                        show_map[ep["show_id"]],
                        ep["episode_guid"],
                        ep["title"],
                        ep["description"],
                        ep["season"],
                        ep["episode_number"],
                        ep["duration"],
                        ep["enclosure_url"],
                        ep["transcript_status"],
                        ep["transcript_error"],
                        ep["image_url"],
                        ep["published_at"],
                        ep["metadata"],
                        ep["created_at"],
                        ep["updated_at"],
                        ep.get("transcript_source"),
                    )
                    episode_map[ep["id"]] = ep["id"]

            # Update sequence to avoid ID conflicts on future inserts
            max_episode_id = max(e["id"] for e in remote_episodes)
            await local_conn.execute(
                f"SELECT setval('podcast_episodes_id_seq', GREATEST((SELECT MAX(id) FROM podcast_episodes), {max_episode_id}))"
            )
            print(f"  ✅ {len(remote_episodes)} episodes (IDs preserved for R2 paths)")

        # 0b. Channels & Videos (preserve IDs for transcript path compatibility)
        print("📦 Cloning channels and videos referenced by user sources...")
        remote_video_sources = await remote_conn.fetch(
            "SELECT DISTINCT video_id FROM sources WHERE user_id = $1 AND video_id IS NOT NULL",
            remote_user_id,
        )
        remote_video_ids = [r["video_id"] for r in remote_video_sources]

        if remote_video_ids:
            remote_videos = await remote_conn.fetch(
                "SELECT * FROM videos WHERE id = ANY($1)", remote_video_ids
            )
            remote_channel_ids = list(
                set(r["channel_id"] for r in remote_videos if r["channel_id"])
            )

            if remote_channel_ids:
                remote_channels = await remote_conn.fetch(
                    "SELECT * FROM channels WHERE id = ANY($1)", remote_channel_ids
                )
                for channel in remote_channels:
                    # Check if channel with this ID already exists
                    existing = await local_conn.fetchval(
                        "SELECT id FROM channels WHERE id = $1", channel["id"]
                    )
                    if existing:
                        # Update existing channel
                        await local_conn.execute(
                            """UPDATE channels SET platform = $2, platform_id = $3, name = $4,
                               description = $5, thumbnail_url = $6, subscriber_count = $7,
                               video_count = $8, custom_url = $9, metadata = $10, updated_at = $11
                               WHERE id = $1""",
                            channel["id"],
                            channel["platform"],
                            channel["platform_id"],
                            channel["name"],
                            channel["description"],
                            channel["thumbnail_url"],
                            channel["subscriber_count"],
                            channel["video_count"],
                            channel["custom_url"],
                            channel["metadata"],
                            channel["updated_at"],
                        )
                        channel_map[channel["id"]] = channel["id"]
                    else:
                        # Insert with explicit ID to preserve remote ID
                        await local_conn.execute(
                            """INSERT INTO channels (id, platform, platform_id, name, description,
                               thumbnail_url, subscriber_count, video_count, custom_url, metadata,
                               created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)""",
                            channel["id"],
                            channel["platform"],
                            channel["platform_id"],
                            channel["name"],
                            channel["description"],
                            channel["thumbnail_url"],
                            channel["subscriber_count"],
                            channel["video_count"],
                            channel["custom_url"],
                            channel["metadata"],
                            channel["created_at"],
                            channel["updated_at"],
                        )
                        channel_map[channel["id"]] = channel["id"]

                # Update sequence to avoid ID conflicts on future inserts
                max_channel_id = max(c["id"] for c in remote_channels)
                await local_conn.execute(
                    f"SELECT setval('channels_id_seq', GREATEST((SELECT MAX(id) FROM channels), {max_channel_id}))"
                )
                print(f"  ✅ {len(remote_channels)} channels (IDs preserved)")

            for vid in remote_videos:
                # Check if video with this ID already exists
                existing = await local_conn.fetchval(
                    "SELECT id FROM videos WHERE id = $1", vid["id"]
                )
                if existing:
                    # Update existing video
                    await local_conn.execute(
                        """UPDATE videos SET channel_id = $2, platform = $3, platform_id = $4,
                           title = $5, description = $6, thumbnail_url = $7, duration = $8,
                           view_count = $9, embed_url = $10, transcript_status = $11,
                           transcript_error = $12, transcript_source = $13, published_at = $14,
                           metadata = $15, updated_at = $16
                           WHERE id = $1""",
                        vid["id"],
                        channel_map.get(vid["channel_id"]),
                        vid["platform"],
                        vid["platform_id"],
                        vid["title"],
                        vid["description"],
                        vid["thumbnail_url"],
                        vid["duration"],
                        vid["view_count"],
                        vid["embed_url"],
                        vid["transcript_status"],
                        vid["transcript_error"],
                        vid.get("transcript_source"),
                        vid["published_at"],
                        vid["metadata"],
                        vid["updated_at"],
                    )
                    video_map[vid["id"]] = vid["id"]
                else:
                    # Insert with explicit ID to preserve remote ID (critical for transcript paths!)
                    await local_conn.execute(
                        """INSERT INTO videos (id, channel_id, platform, platform_id, title,
                           description, thumbnail_url, duration, view_count, embed_url,
                           transcript_status, transcript_error, transcript_source, published_at,
                           metadata, created_at, updated_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)""",
                        vid["id"],
                        channel_map.get(vid["channel_id"]),
                        vid["platform"],
                        vid["platform_id"],
                        vid["title"],
                        vid["description"],
                        vid["thumbnail_url"],
                        vid["duration"],
                        vid["view_count"],
                        vid["embed_url"],
                        vid["transcript_status"],
                        vid["transcript_error"],
                        vid.get("transcript_source"),
                        vid["published_at"],
                        vid["metadata"],
                        vid["created_at"],
                        vid["updated_at"],
                    )
                    video_map[vid["id"]] = vid["id"]

            # Update sequence to avoid ID conflicts on future inserts
            max_video_id = max(v["id"] for v in remote_videos)
            await local_conn.execute(
                f"SELECT setval('videos_id_seq', GREATEST((SELECT MAX(id) FROM videos), {max_video_id}))"
            )
            print(
                f"  ✅ {len(remote_videos)} videos (IDs preserved for transcript paths)"
            )

        # 1. Sources
        print("📦 Cloning sources...")
        sources = await remote_conn.fetch(
            "SELECT * FROM sources WHERE user_id = $1", remote_user_id
        )
        for src in sources:
            status = src.get("status") or "todo"
            if status == "completed":
                status = "done"
            if status not in {"todo", "in_progress", "reflecting", "done"}:
                status = "todo"

            completed_at = src.get("completed_at") or src.get("archived_at")

            existing_id = await local_conn.fetchval(
                "SELECT id FROM sources WHERE user_id = $1 AND title = $2 AND type = $3",
                local_user_id,
                src["title"],
                src["type"],
            )
            local_id = existing_id or await local_conn.fetchval(
                """INSERT INTO sources (user_id, title, type, status, metadata, summary_short,
                   summary_long, last_active_at, completed_at, created_at, updated_at, label,
                   author, published_at, episode_id, video_id, pdf_object_key, started_at, reflecting_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                   RETURNING id""",
                local_user_id,
                src["title"],
                src["type"],
                status,
                src["metadata"],
                src["summary_short"],
                src["summary_long"],
                src["last_active_at"],
                completed_at,
                src["created_at"],
                src["updated_at"],
                src.get("label"),
                src.get("author"),
                src.get("published_at"),
                episode_map.get(src.get("episode_id")),
                video_map.get(src.get("video_id")),
                src.get("pdf_object_key"),
                src.get("started_at"),
                src.get("reflecting_at"),
            )
            source_map[src["id"]] = local_id
        print(f"  ✅ {len(sources)} sources")

        # 2. Source sections
        if source_map:
            print("📦 Cloning source sections...")
            sections = await remote_conn.fetch(
                "SELECT * FROM source_sections WHERE source_id = ANY($1) ORDER BY id",
                list(source_map.keys()),
            )
            for sec in sections:
                existing_id = await local_conn.fetchval(
                    """SELECT id FROM source_sections
                        WHERE source_id = $1 AND title = $2 AND order_index = $3""",
                    source_map[sec["source_id"]],
                    sec["title"],
                    sec["order_index"],
                )
                local_id = existing_id or await local_conn.fetchval(
                    """INSERT INTO source_sections (source_id, title, subtitle, order_index,
                       range_start, range_end, summary, summary_sha256, generated_by,
                       created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id""",
                    source_map[sec["source_id"]],
                    sec["title"],
                    sec["subtitle"],
                    sec["order_index"],
                    sec["range_start"],
                    sec["range_end"],
                    sec["summary"],
                    sec["summary_sha256"],
                    sec["generated_by"],
                    sec["created_at"],
                    sec["updated_at"],
                )
                section_map[sec["id"]] = local_id
            print(f"  ✅ {len(sections)} sections")

        # 2b. Suggestions (must precede captures, which FK suggestion_id)
        if source_map:
            try:
                print("📦 Cloning suggestions...")
                suggestions_rows = await remote_conn.fetch(
                    "SELECT * FROM suggestions WHERE user_id = $1 AND source_id = ANY($2) ORDER BY id",
                    remote_user_id,
                    list(source_map.keys()),
                )
                for sug in suggestions_rows:
                    local_source_id = source_map.get(sug["source_id"])
                    if not local_source_id:
                        continue
                    local_episode_id = (
                        episode_map.get(sug["episode_id"])
                        if sug.get("episode_id") is not None
                        else None
                    )
                    existing_id = await local_conn.fetchval(
                        """SELECT id FROM suggestions
                           WHERE user_id = $1
                             AND source_id = $2
                             AND created_at = $3
                             AND COALESCE(client_id, '') = COALESCE($4, '')""",
                        local_user_id,
                        local_source_id,
                        sug["created_at"],
                        sug.get("client_id"),
                    )
                    if existing_id:
                        local_id = await local_conn.fetchval(
                            """UPDATE suggestions SET episode_id = $2, origin = $3, status = $4,
                                   suggested_action = $5, playback_position_seconds = $6,
                                   recorded_at = $7, audio_r2_key = $8, voice_transcript = $9,
                                   suggested_payload = $10, processing_metadata = $11,
                                   error = $12, reviewed_at = $13, updated_at = $14
                               WHERE id = $1
                               RETURNING id""",
                            existing_id,
                            local_episode_id,
                            sug["origin"],
                            sug["status"],
                            sug.get("suggested_action"),
                            sug.get("playback_position_seconds"),
                            sug.get("recorded_at"),
                            sug.get("audio_r2_key"),
                            sug.get("voice_transcript"),
                            sug.get("suggested_payload"),
                            sug.get("processing_metadata") or {},
                            sug.get("error"),
                            sug.get("reviewed_at"),
                            sug["updated_at"],
                        )
                    else:
                        local_id = await local_conn.fetchval(
                            """INSERT INTO suggestions (client_id, user_id, source_id, episode_id,
                                   origin, status, suggested_action, playback_position_seconds,
                                   recorded_at, audio_r2_key, voice_transcript, suggested_payload,
                                   processing_metadata, error, reviewed_at, created_at, updated_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                               RETURNING id""",
                            sug.get("client_id"),
                            local_user_id,
                            local_source_id,
                            local_episode_id,
                            sug["origin"],
                            sug["status"],
                            sug.get("suggested_action"),
                            sug.get("playback_position_seconds"),
                            sug.get("recorded_at"),
                            sug.get("audio_r2_key"),
                            sug.get("voice_transcript"),
                            sug.get("suggested_payload"),
                            sug.get("processing_metadata") or {},
                            sug.get("error"),
                            sug.get("reviewed_at"),
                            sug["created_at"],
                            sug["updated_at"],
                        )
                    suggestion_map[sug["id"]] = local_id
                print(f"  ✅ {len(suggestion_map)} suggestions")
            except exceptions.UndefinedTableError:
                print("  ⏭️  suggestions table not found, skipping")

        # 3. Citations
        print("📦 Cloning citations...")
        citations = await remote_conn.fetch(
            "SELECT * FROM citations WHERE user_id = $1", remote_user_id
        )
        for cit in citations:
            existing_id = await local_conn.fetchval(
                "SELECT id FROM citations WHERE user_id = $1 AND text_sha256 = $2",
                local_user_id,
                cit["text_sha256"],
            )
            local_id = existing_id or await local_conn.fetchval(
                """INSERT INTO citations (user_id, info_type, text, summary, source_id,
                   location, text_sha256, section_id, created_at, updated_at, speaker, context)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id""",
                local_user_id,
                cit["info_type"],
                cit["text"],
                cit["summary"],
                source_map.get(cit["source_id"]),
                cit["location"],
                cit["text_sha256"],
                section_map.get(cit["section_id"]),
                cit["created_at"],
                cit["updated_at"],
                cit.get("speaker"),
                cit.get("context"),
            )
            citation_map[cit["id"]] = local_id
        print(f"  ✅ {len(citations)} citations")

        # 4. Captures
        print("📦 Cloning captures...")
        captures = await remote_conn.fetch(
            "SELECT * FROM captures WHERE user_id = $1", remote_user_id
        )
        for cap in captures:
            existing_id = await local_conn.fetchval(
                "SELECT id FROM captures WHERE user_id = $1 AND content_sha256 = $2",
                local_user_id,
                cap["content_sha256"],
            )
            local_id = existing_id or await local_conn.fetchval(
                """INSERT INTO captures (user_id, citation_id, source_id, section_id,
                   content, summary, content_sha256, deleted_at, created_at, updated_at, suggestion_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id""",
                local_user_id,
                citation_map.get(cap["citation_id"]),
                source_map.get(cap["source_id"]),
                section_map.get(cap["section_id"]),
                cap["content"],
                cap["summary"],
                cap["content_sha256"],
                cap["deleted_at"],
                cap["created_at"],
                cap["updated_at"],
                suggestion_map.get(cap.get("suggestion_id"))
                if cap.get("suggestion_id") is not None
                else None,
            )
            capture_map[cap["id"]] = local_id
        print(f"  ✅ {len(captures)} captures")

        # 5. Tags
        print("📦 Cloning tags...")
        tags = await remote_conn.fetch(
            "SELECT * FROM tags WHERE user_id = $1", remote_user_id
        )
        for tag in tags:
            local_id = await local_conn.fetchval(
                """INSERT INTO tags (user_id, slug, label, color, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT ON CONSTRAINT tags_user_id_slug_key
                   DO UPDATE SET label = EXCLUDED.label, color = EXCLUDED.color, updated_at = EXCLUDED.updated_at
                   RETURNING id""",
                local_user_id,
                tag["slug"],
                tag["label"],
                tag["color"],
                tag["created_at"],
                tag["updated_at"],
            )
            tag_map[tag["id"]] = local_id
        print(f"  ✅ {len(tags)} tags")

        # 6. Source takeaways
        print("📦 Cloning source takeaways...")
        takeaways = await remote_conn.fetch(
            "SELECT * FROM source_takeaways WHERE user_id = $1", remote_user_id
        )
        for ta in takeaways:
            existing_id = await local_conn.fetchval(
                """SELECT id FROM source_takeaways
                       WHERE user_id = $1 AND source_id = $2 AND title = $3""",
                local_user_id,
                source_map.get(ta["source_id"]),
                ta["title"],
            )
            local_id = existing_id or await local_conn.fetchval(
                """INSERT INTO source_takeaways (user_id, source_id, title, body, created_at, updated_at, content_sha256)
                   VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
                local_user_id,
                source_map.get(ta["source_id"]),
                ta["title"],
                ta["body"],
                ta["created_at"],
                ta["updated_at"],
                ta.get("content_sha256"),
            )
            takeaway_map[ta["id"]] = local_id
        print(f"  ✅ {len(takeaways)} takeaways")

        # 7. Notes
        print("📦 Cloning notes...")
        try:
            notes = await remote_conn.fetch(
                "SELECT * FROM notes WHERE user_id = $1 ORDER BY id", remote_user_id
            )
            skipped_notes = 0
            for note in notes:
                remote_source_id = note["source_id"]
                if remote_source_id is not None and remote_source_id not in source_map:
                    skipped_notes += 1
                    continue

                local_source_id = (
                    source_map[remote_source_id]
                    if remote_source_id is not None
                    else None
                )
                existing_id = await local_conn.fetchval(
                    """SELECT id FROM notes
                       WHERE user_id = $1
                         AND source_id IS NOT DISTINCT FROM $2
                         AND created_at = $3""",
                    local_user_id,
                    local_source_id,
                    note["created_at"],
                )
                if existing_id:
                    local_id = await local_conn.fetchval(
                        """UPDATE notes
                           SET title = $2, kind = $3, body = $4, plain_text = $5,
                               updated_at = $6
                           WHERE id = $1
                           RETURNING id""",
                        existing_id,
                        note["title"],
                        note["kind"],
                        note["body"],
                        note["plain_text"],
                        note["updated_at"],
                    )
                else:
                    local_id = await local_conn.fetchval(
                        """INSERT INTO notes (user_id, source_id, title, kind, body,
                           plain_text, created_at, updated_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                           RETURNING id""",
                        local_user_id,
                        local_source_id,
                        note["title"],
                        note["kind"],
                        note["body"],
                        note["plain_text"],
                        note["created_at"],
                        note["updated_at"],
                    )
                note_map[note["id"]] = local_id

            if skipped_notes:
                print(f"  ⚠️  skipped {skipped_notes} notes with missing sources")
            print(f"  ✅ {len(note_map)} notes")
        except exceptions.UndefinedTableError:
            print("  ⏭️  notes table not found, skipping")

        if note_map and citation_map:
            try:
                print("📦 Cloning note_citations...")
                note_citations = await remote_conn.fetch(
                    "SELECT * FROM note_citations WHERE note_id = ANY($1)",
                    list(note_map.keys()),
                )
                count = 0
                for nc in note_citations:
                    if nc["citation_id"] in citation_map:
                        await local_conn.execute(
                            """INSERT INTO note_citations (note_id, citation_id)
                               VALUES ($1, $2)
                               ON CONFLICT ON CONSTRAINT note_citations_pkey DO NOTHING""",
                            note_map[nc["note_id"]],
                            citation_map[nc["citation_id"]],
                        )
                        count += 1
                print(f"  ✅ {count} note_citations")
            except exceptions.UndefinedTableError:
                print("  ⏭️  note_citations table not found, skipping")

        # 8. Junction tables
        if source_map and tag_map:
            print("📦 Cloning source_tags...")
            source_tags = await remote_conn.fetch(
                "SELECT * FROM source_tags WHERE source_id = ANY($1)",
                list(source_map.keys()),
            )
            for st in source_tags:
                if st["tag_id"] in tag_map:
                    await local_conn.execute(
                        "INSERT INTO source_tags (source_id, tag_id, created_at) VALUES ($1, $2, $3)"
                        " ON CONFLICT ON CONSTRAINT source_tags_pkey DO NOTHING",
                        source_map[st["source_id"]],
                        tag_map[st["tag_id"]],
                        st["created_at"],
                    )
            print(f"  ✅ {len(source_tags)} source_tags")

        # Collections
        if source_map:
            try:
                print("📦 Cloning collections...")
                collections = await remote_conn.fetch(
                    "SELECT * FROM collections WHERE user_id = $1", remote_user_id
                )
                collection_map: dict[int, int] = {}
                for col in collections:
                    local_id = await local_conn.fetchval(
                        """INSERT INTO collections (user_id, name, description, created_at, updated_at)
                           VALUES ($1, $2, $3, $4, $5) RETURNING id""",
                        local_user_id,
                        col["name"],
                        col["description"],
                        col["created_at"],
                        col["updated_at"],
                    )
                    collection_map[col["id"]] = local_id
                print(f"  ✅ {len(collections)} collections")

                if collection_map:
                    print("📦 Cloning collection_sources...")
                    col_sources = await remote_conn.fetch(
                        "SELECT * FROM collection_sources WHERE collection_id = ANY($1)",
                        list(collection_map.keys()),
                    )
                    count = 0
                    for cs in col_sources:
                        if cs["source_id"] in source_map:
                            await local_conn.execute(
                                """INSERT INTO collection_sources (collection_id, source_id, created_at)
                                   VALUES ($1, $2, $3)
                                   ON CONFLICT ON CONSTRAINT collection_sources_pkey DO NOTHING""",
                                collection_map[cs["collection_id"]],
                                source_map[cs["source_id"]],
                                cs["created_at"],
                            )
                            count += 1
                    print(f"  ✅ {count} collection_sources")
            except Exception as e:
                print(f"  ⏭️  collections skipped: {e}")

        if takeaway_map and citation_map:
            try:
                print("📦 Cloning source_takeaway_citations...")
                ta_citations = await remote_conn.fetch(
                    "SELECT * FROM source_takeaway_citations WHERE takeaway_id = ANY($1)",
                    list(takeaway_map.keys()),
                )
                for tac in ta_citations:
                    if tac["citation_id"] in citation_map:
                        await local_conn.execute(
                            "INSERT INTO source_takeaway_citations (takeaway_id, citation_id, created_at) VALUES ($1, $2, $3)"
                            " ON CONFLICT ON CONSTRAINT source_takeaway_citations_pkey DO NOTHING",
                            takeaway_map[tac["takeaway_id"]],
                            citation_map[tac["citation_id"]],
                            tac["created_at"],
                        )
                print(f"  ✅ {len(ta_citations)} takeaway_citations")
            except Exception:
                print("  ⏭️  source_takeaway_citations table not found, skipping")

        if takeaway_map and capture_map:
            try:
                print("📦 Cloning source_takeaway_captures...")
                ta_captures = await remote_conn.fetch(
                    "SELECT * FROM source_takeaway_captures WHERE takeaway_id = ANY($1)",
                    list(takeaway_map.keys()),
                )
                for tac in ta_captures:
                    if tac["capture_id"] in capture_map:
                        await local_conn.execute(
                            "INSERT INTO source_takeaway_captures (takeaway_id, capture_id, created_at) VALUES ($1, $2, $3)"
                            " ON CONFLICT ON CONSTRAINT source_takeaway_captures_pkey DO NOTHING",
                            takeaway_map[tac["takeaway_id"]],
                            capture_map[tac["capture_id"]],
                            tac["created_at"],
                        )
                print(f"  ✅ {len(ta_captures)} takeaway_captures")
            except Exception:
                print("  ⏭️  source_takeaway_captures table not found, skipping")

        # 8. Review Items
        review_item_map = {}
        try:
            print("📦 Cloning review_items...")
            review_items = await remote_conn.fetch(
                "SELECT * FROM review_items WHERE user_id = $1", remote_user_id
            )
            for ri in review_items:
                # Polymorphic ID mapping
                local_item_id = None
                if ri["item_type"] == "takeaway":
                    local_item_id = takeaway_map.get(ri["item_id"])
                elif ri["item_type"] == "citation":
                    local_item_id = citation_map.get(ri["item_id"])
                elif ri["item_type"] == "idea":
                    # idea_map not implemented yet
                    pass

                if not local_item_id:
                    # Skip if linked item not found (or idea type)
                    continue

                local_id = await local_conn.fetchval(
                    """INSERT INTO review_items (user_id, item_type, item_id, prompt, prompt_sha256,
                       answer, answer_sha256, review_type, metadata, source_id, idea_id, state,
                       introduced_at, due_at, ease_factor, interval_days, repetitions, last_reviewed_at,
                       suspended_at, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                       ON CONFLICT (user_id, item_type, item_id, prompt_sha256) DO UPDATE SET
                       state = EXCLUDED.state, due_at = EXCLUDED.due_at, updated_at = EXCLUDED.updated_at
                       RETURNING id""",
                    local_user_id,
                    ri["item_type"],
                    local_item_id,
                    ri["prompt"],
                    ri["prompt_sha256"],
                    ri["answer"],
                    ri["answer_sha256"],
                    ri["review_type"],
                    ri["metadata"],
                    source_map.get(ri["source_id"]),
                    None,
                    ri["state"],
                    ri["introduced_at"],
                    ri["due_at"],
                    ri["ease_factor"],
                    ri["interval_days"],
                    ri["repetitions"],
                    ri["last_reviewed_at"],
                    ri["suspended_at"],
                    ri["created_at"],
                    ri["updated_at"],
                )
                if local_id:
                    review_item_map[ri["id"]] = local_id
            print(f"  ✅ {len(review_item_map)} review_items")
        except exceptions.UndefinedTableError:
            print("  ⏭️  review_items table not found, skipping")

        # 9. Review Suggestions
        try:
            print("📦 Cloning review_suggestions...")
            suggestions = await remote_conn.fetch(
                "SELECT * FROM review_suggestions WHERE user_id = $1", remote_user_id
            )
            count = 0
            for sug in suggestions:
                # Polymorphic ID mapping
                local_item_id = None
                if sug["item_type"] == "takeaway":
                    local_item_id = takeaway_map.get(sug["item_id"])
                elif sug["item_type"] == "citation":
                    local_item_id = citation_map.get(sug["item_id"])

                if not local_item_id:
                    continue

                await local_conn.execute(
                    """INSERT INTO review_suggestions (user_id, source_id, item_type, item_id, prompt, prompt_sha256,
                       answer, answer_sha256, review_type, reasoning, metadata, status, reviewed_at, created_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                       ON CONFLICT (user_id, item_type, item_id, prompt_sha256) DO NOTHING""",
                    local_user_id,
                    source_map.get(sug["source_id"]),
                    sug["item_type"],
                    local_item_id,
                    sug["prompt"],
                    sug["prompt_sha256"],
                    sug["answer"],
                    sug["answer_sha256"],
                    sug["review_type"],
                    sug["reasoning"],
                    sug["metadata"],
                    sug["status"],
                    sug["reviewed_at"],
                    sug["created_at"],
                )
                count += 1
            print(f"  ✅ {count} review_suggestions")
        except exceptions.UndefinedTableError:
            print("  ⏭️  review_suggestions table not found, skipping")

        # 10. Reviews
        if review_item_map:
            try:
                print("📦 Cloning reviews...")
                reviews = await remote_conn.fetch(
                    "SELECT * FROM reviews WHERE user_id = $1", remote_user_id
                )
                count = 0
                for rev in reviews:
                    if rev["review_item_id"] in review_item_map:
                        await local_conn.execute(
                            """INSERT INTO reviews (user_id, review_item_id, outcome, time_taken_ms, reviewed_at)
                               VALUES ($1, $2, $3, $4, $5)""",
                            local_user_id,
                            review_item_map[rev["review_item_id"]],
                            rev["outcome"],
                            rev["time_taken_ms"],
                            rev["reviewed_at"],
                        )
                        count += 1
                print(f"  ✅ {count} reviews")
            except exceptions.UndefinedTableError:
                print("  ⏭️  reviews table not found, skipping")

        # 11. RAG embeddings
        if citation_map or capture_map or takeaway_map or section_map or source_map:
            try:
                print("📦 Cloning rag_embeddings...")
                emb_count = 0

                async def _clone_embeddings(column: str, id_map: dict[int, int]):
                    nonlocal emb_count
                    if not id_map:
                        return
                    rows = await remote_conn.fetch(
                        f"SELECT * FROM rag_embeddings WHERE {column} = ANY($1)",
                        list(id_map.keys()),
                    )
                    for emb in rows:
                        local_entity_id = id_map.get(emb[column])
                        if local_entity_id is None:
                            continue
                        await local_conn.execute(
                            f"""INSERT INTO rag_embeddings ({column}, content_sha256, embedding, model, created_at, chunk_index)
                               VALUES ($1, $2, $3, $4, $5, $6)
                               ON CONFLICT ON CONSTRAINT uq_rag_embeddings_{column.replace('_id', '')}
                               DO UPDATE SET content_sha256 = EXCLUDED.content_sha256, embedding = EXCLUDED.embedding, model = EXCLUDED.model, created_at = EXCLUDED.created_at""",
                            local_entity_id,
                            emb["content_sha256"],
                            emb["embedding"],
                            emb["model"],
                            emb["created_at"],
                            emb["chunk_index"],
                        )
                    emb_count += len(rows)

                async def _clone_source_embeddings():
                    nonlocal emb_count
                    if not source_map:
                        return
                    rows = await remote_conn.fetch(
                        "SELECT * FROM rag_embeddings WHERE source_id = ANY($1)",
                        list(source_map.keys()),
                    )
                    for emb in rows:
                        local_source_id = source_map.get(emb["source_id"])
                        if local_source_id is None:
                            continue
                        await local_conn.execute(
                            """INSERT INTO rag_embeddings (source_id, chunk_index, content_sha256, embedding, model, created_at)
                               VALUES ($1, $2, $3, $4, $5, $6)
                               ON CONFLICT ON CONSTRAINT uq_rag_embeddings_source_chunk
                               DO UPDATE SET content_sha256 = EXCLUDED.content_sha256, embedding = EXCLUDED.embedding, model = EXCLUDED.model, created_at = EXCLUDED.created_at""",
                            local_source_id,
                            emb["chunk_index"],
                            emb["content_sha256"],
                            emb["embedding"],
                            emb["model"],
                            emb["created_at"],
                        )
                    emb_count += len(rows)

                await _clone_embeddings("citation_id", citation_map)
                await _clone_embeddings("capture_id", capture_map)
                await _clone_embeddings("takeaway_id", takeaway_map)
                await _clone_embeddings("section_id", section_map)
                await _clone_source_embeddings()

                print(f"  ✅ {emb_count} embeddings")
            except exceptions.UndefinedTableError:
                print("  ⏭️  rag_embeddings table not found, skipping")

        print("✅ Clone complete!")

    finally:
        await remote_conn.close()
        await local_conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Clone a user's data between databases"
    )
    parser.add_argument("--remote-user-id", help="User ID in remote database")
    parser.add_argument("--local-user-id", help="User ID in local database")
    parser.add_argument(
        "--use-local-admin",
        action="store_true",
        default=True,
        help="Use local user with email admin@example.com",
    )
    parser.add_argument(
        "--local-admin-email",
        default="admin@example.com",
        help="Email to use with --use-local-admin (default: admin@example.com)",
    )
    args = parser.parse_args()

    remote_user_id = args.remote_user_id or input("Remote user ID: ").strip()
    local_user_id = args.local_user_id

    if not args.use_local_admin and not local_user_id:
        local_user_id = input("Local user ID: ").strip()

    if not remote_user_id:
        print("Error: Remote user ID is required", file=sys.stderr)
        sys.exit(1)

    if not args.use_local_admin and not local_user_id:
        print(
            "Error: Local user ID is required (or pass --use-local-admin)",
            file=sys.stderr,
        )
        sys.exit(1)

    remote_url = os.getenv("REMOTE_DB_URL", "").strip().strip("'").strip('"')
    local_url = os.getenv("DATABASE_URL", "").strip().strip("'").strip('"')

    if not remote_url or not local_url:
        print("Error: REMOTE_DB_URL or DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    asyncio.run(
        clone_user_data(
            remote_url,
            local_url,
            remote_user_id,
            local_user_id,
            use_local_admin=args.use_local_admin,
            local_admin_email=args.local_admin_email,
        )
    )


if __name__ == "__main__":
    main()
