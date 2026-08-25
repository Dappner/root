"""Backfill transcript-chunk embeddings for podcast/video sources missing them.

Used by `/admin/embeddings/*`. Finds sources whose linked episode/video has a
transcript artifact in R2 but no `rag_embeddings.source_id` rows, fetches the
JSON, embeds via `TranscriptEmbeddingService`, and corrects the lying
`transcript_status` (some prod rows are marked `embedded` despite having zero
chunks).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import get_logger
from app.integrations.r2 import R2Client
from app.models.database import PodcastEpisode, RagEmbedding, Source, Video
from app.services.transcript_embedding_service import TranscriptEmbeddingService

logger = get_logger(__name__)


@dataclass(frozen=True)
class _Candidate:
    source_id: int
    source_type: str  # 'podcast' | 'video'
    episode_id: int | None
    video_id: int | None
    episode_title: str | None
    episode_published_at: str | None


@dataclass(frozen=True)
class TranscriptBackfillResult:
    embedded_sources: int
    failed_sources: int
    skipped_sources: int  # no transcript artifact in R2


class TranscriptEmbeddingBackfillService:
    def __init__(
        self,
        *,
        session_factory: async_sessionmaker[AsyncSession],
        r2: R2Client,
        embedding: TranscriptEmbeddingService,
        http_timeout: float = 30.0,
    ) -> None:
        self._session_factory = session_factory
        self._r2 = r2
        self._embedding = embedding
        self._http_timeout = http_timeout

    async def count_stale(self, user_id: str) -> int:
        async with self._session_factory() as db:
            rows = await self._find_candidates(db, user_id=user_id, limit=None)
        return len(rows)

    async def refresh_stale(self, *, user_id: str, limit: int) -> TranscriptBackfillResult:
        async with self._session_factory() as db:
            candidates = await self._find_candidates(db, user_id=user_id, limit=limit)

        embedded = 0
        failed = 0
        skipped = 0

        async with httpx.AsyncClient(timeout=self._http_timeout) as http:
            for cand in candidates:
                r2_key = _transcript_key(cand)
                if r2_key is None:
                    skipped += 1
                    continue

                try:
                    transcript = await _fetch_transcript(http, self._r2, r2_key)
                except FileNotFoundError:
                    skipped += 1
                    continue
                except Exception:
                    logger.exception(
                        "transcript fetch failed",
                        extra={"source_id": cand.source_id, "r2_key": r2_key},
                    )
                    failed += 1
                    continue

                try:
                    async with self._session_factory() as db:
                        # Single transaction: chunk writes + status flip land
                        # atomically. `embed_episode_transcript` no longer
                        # commits the caller's session (see
                        # fast-api/AGENTS.md: takes-db services don't commit).
                        written = await self._embedding.embed_episode_transcript(
                            source_id=cand.source_id,
                            transcript_data=transcript,
                            db=db,
                            episode_title=cand.episode_title,
                            show_title=None,
                            published_at=cand.episode_published_at,
                        )
                        await _mark_embedded(db, cand)
                        await db.commit()
                    if written > 0:
                        embedded += 1
                    else:
                        skipped += 1
                except (SQLAlchemyError, RuntimeError, ValueError):
                    logger.exception(
                        "transcript embed failed",
                        extra={"source_id": cand.source_id},
                    )
                    failed += 1

        return TranscriptBackfillResult(
            embedded_sources=embedded,
            failed_sources=failed,
            skipped_sources=skipped,
        )

    async def _find_candidates(
        self, db: AsyncSession, *, user_id: str, limit: int | None
    ) -> list[_Candidate]:
        # Sources of type podcast/video for the user that have NO source_id
        # chunk rows. We don't filter by transcript_status because prod has
        # rows incorrectly marked `embedded` with zero chunks.
        no_chunks = ~select(RagEmbedding.id).where(RagEmbedding.source_id == Source.id).exists()

        stmt = (
            select(
                Source.id,
                Source.type,
                Source.episode_id,
                Source.video_id,
                PodcastEpisode.title,
                PodcastEpisode.published_at,
            )
            .outerjoin(PodcastEpisode, PodcastEpisode.id == Source.episode_id)
            .outerjoin(Video, Video.id == Source.video_id)
            .where(
                Source.user_id == user_id,
                Source.type.in_(("podcast", "video")),
                no_chunks,
            )
            .order_by(Source.id.asc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)

        rows = (await db.execute(stmt)).all()
        return [
            _Candidate(
                source_id=r[0],
                source_type=r[1],
                episode_id=r[2],
                video_id=r[3],
                episode_title=r[4],
                episode_published_at=r[5].strftime("%Y-%m-%d") if r[5] else None,
            )
            for r in rows
        ]


def _transcript_key(c: _Candidate) -> str | None:
    if c.source_type == "podcast" and c.episode_id is not None:
        return f"podcasts/{c.episode_id}/transcript.json"
    if c.source_type == "video" and c.video_id is not None:
        return f"videos/{c.video_id}/transcript.json"
    return None


async def _fetch_transcript(http: httpx.AsyncClient, r2: R2Client, key: str) -> dict[str, Any]:
    url = r2.get_public_url(key)
    response = await http.get(url)
    if response.status_code == 404:
        raise FileNotFoundError(key)
    response.raise_for_status()
    data: dict[str, Any] = response.json()
    return data


async def _mark_embedded(db: AsyncSession, c: _Candidate) -> None:
    if c.source_type == "podcast" and c.episode_id is not None:
        ep = await db.get(PodcastEpisode, c.episode_id)
        if ep is not None:
            ep.transcript_status = "embedded"
            ep.transcript_error = None
    elif c.source_type == "video" and c.video_id is not None:
        v = await db.get(Video, c.video_id)
        if v is not None:
            v.transcript_status = "embedded"
            v.transcript_error = None
