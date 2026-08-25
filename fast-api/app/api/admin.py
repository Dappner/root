"""Admin endpoints — stale-embedding count + per-user batch refresh."""

from __future__ import annotations

import asyncio
from typing import Annotated

import logfire
from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin_user
from app.core.database import get_db
from app.core.routing import APIRouter
from app.deps import (
    citation_embedding_service,
    section_summary_embedding_service,
    source_repository,
    stats_service,
    takeaway_embedding_service,
    transcript_backfill_service,
)
from app.repositories.source_repository import SourceRepository
from app.schemas.stats import UserStatsResponse
from app.services.citation_embedding_service import CitationEmbeddingService
from app.services.section_summary_embedding_service import SectionSummaryEmbeddingService
from app.services.stats_service import StatsService
from app.services.takeaway_embedding_service import TakeawayEmbeddingService
from app.services.transcript_embedding_backfill_service import (
    TranscriptEmbeddingBackfillService,
)


class StaleEmbeddingsCountResponse(BaseModel):
    stale_count: int
    user_id: str


class ProcessEmbeddingsResponse(BaseModel):
    processed: int
    user_id: str
    limit: int
    transcript_sources_embedded: int
    transcript_sources_failed: int
    transcript_sources_skipped: int


class TranscriptEpisode(BaseModel):
    sourceId: int  # noqa: N815 — camelCase mirrors the legacy Next.js admin route shape
    sourceTitle: str  # noqa: N815
    episodeId: int  # noqa: N815
    episodeTitle: str  # noqa: N815
    transcriptStatus: str  # noqa: N815


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin_user)],
)


@router.get(
    "/embeddings/stale-count",
    response_model=StaleEmbeddingsCountResponse,
)
async def get_stale_embeddings_count(
    citations: Annotated[CitationEmbeddingService, Depends(citation_embedding_service)],
    takeaways: Annotated[TakeawayEmbeddingService, Depends(takeaway_embedding_service)],
    sections: Annotated[SectionSummaryEmbeddingService, Depends(section_summary_embedding_service)],
    transcripts: Annotated[
        TranscriptEmbeddingBackfillService, Depends(transcript_backfill_service)
    ],
    user_id: str = Query(..., description="User to scope the stale-count to"),
) -> StaleEmbeddingsCountResponse:
    """Count citations + captures + takeaways + section summaries + transcript
    sources missing embeddings for one user. Each transcript source counts as
    one unit even though embedding it produces many chunk rows."""
    citation_count, takeaway_count, section_count, transcript_count = await asyncio.gather(
        citations.count_stale(user_id=user_id),
        takeaways.count_stale(user_id=user_id),
        sections.count_stale(user_id=user_id),
        transcripts.count_stale(user_id=user_id),
    )
    return StaleEmbeddingsCountResponse(
        stale_count=citation_count + takeaway_count + section_count + transcript_count,
        user_id=user_id,
    )


@router.post(
    "/embeddings/process",
    response_model=ProcessEmbeddingsResponse,
)
async def process_stale_embeddings(
    citations: Annotated[CitationEmbeddingService, Depends(citation_embedding_service)],
    takeaways: Annotated[TakeawayEmbeddingService, Depends(takeaway_embedding_service)],
    sections: Annotated[SectionSummaryEmbeddingService, Depends(section_summary_embedding_service)],
    transcripts: Annotated[
        TranscriptEmbeddingBackfillService, Depends(transcript_backfill_service)
    ],
    user_id: str = Query(..., description="User to scope the refresh to"),
    limit: int = Query(default=100, ge=1, le=200, description="Max items per type"),
) -> ProcessEmbeddingsResponse:
    """Regenerate stale embeddings for one user across citations, captures,
    takeaways, section summaries, and podcast/video transcript chunks. `limit`
    caps each type independently; for transcripts it caps the number of
    sources backfilled (each source still generates many chunk rows)."""
    citation_done, takeaway_done, section_done, transcript_result = await asyncio.gather(
        citations.refresh_stale(limit=limit, user_id=user_id),
        takeaways.refresh_stale(limit=limit, user_id=user_id),
        sections.refresh_stale(limit=limit, user_id=user_id),
        transcripts.refresh_stale(limit=limit, user_id=user_id),
    )
    total = citation_done + takeaway_done + section_done + transcript_result.embedded_sources
    logfire.info(
        "embedding_processed",
        user_id=user_id,
        limit=limit,
        processed_total=total,
        processed_citations=citation_done,
        processed_takeaways=takeaway_done,
        processed_sections=section_done,
        transcript_sources_embedded=transcript_result.embedded_sources,
        transcript_sources_failed=transcript_result.failed_sources,
        transcript_sources_skipped=transcript_result.skipped_sources,
    )
    return ProcessEmbeddingsResponse(
        processed=total,
        user_id=user_id,
        limit=limit,
        transcript_sources_embedded=transcript_result.embedded_sources,
        transcript_sources_failed=transcript_result.failed_sources,
        transcript_sources_skipped=transcript_result.skipped_sources,
    )


@router.get(
    "/users/{user_id}/stats",
    response_model=UserStatsResponse,
    operation_id="GetUserStats",
)
async def get_user_stats(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    service: Annotated[StatsService, Depends(stats_service)],
    weeks_back: int = Query(
        default=12,
        ge=1,
        le=53,
        description="Weeks of activity history (1-53)",
    ),
) -> UserStatsResponse:
    """Aggregate counts, 30-day deltas, weekly trends, focus areas, and a
    deterministic takeaway-of-the-day for a user. Admin-only via the
    router-level dependency on `require_admin_user`."""
    return await service.get_for_user(db, user_id, weeks_back=weeks_back)


@router.get(
    "/transcript-episodes",
    response_model=list[TranscriptEpisode],
    operation_id="GetTranscriptEpisodes",
)
async def get_transcript_episodes(
    db: Annotated[AsyncSession, Depends(get_db)],
    repo: Annotated[SourceRepository, Depends(source_repository)],
) -> list[TranscriptEpisode]:
    """List podcast sources whose episode has a finished ('transcribed')
    transcript, ready to be embedded. One row per episode (DISTINCT ON dedupes
    sources that point at the same episode). Admin-only via the router-level
    dependency on `require_admin_user`."""
    rows = await repo.list_transcribed_episode_rows(db)
    return [
        TranscriptEpisode(
            sourceId=source_id,
            sourceTitle=source_title,
            episodeId=episode_id,
            episodeTitle=episode_title,
            transcriptStatus=transcript_status,
        )
        for (source_id, source_title, episode_id, episode_title, transcript_status) in rows
    ]
