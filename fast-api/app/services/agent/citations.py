"""Citation helpers for Jetflow actions."""

from __future__ import annotations

from typing import Dict, Iterable

from jetflow.models.citations import BaseCitation
from pydantic import ConfigDict

from app.schemas.rag import RetrievalHit


class RagCitation(BaseCitation):
    """Citation model for RAG hits (capture/citation/takeaway/section summary)."""

    model_config = ConfigDict(extra="allow")

    type: str  # discriminator; e.g., "capture" or "citation"
    entity_id: int
    text: str | None = None
    source_id: int | None = None
    source_title: str | None = None
    source_type: str | None = None
    source_author: str | None = None
    source_label: str | None = None
    source_status: str | None = None
    source_published_at: object | None = None
    source_last_active_at: object | None = None
    section_id: int | None = None
    section_title: str | None = None
    section_subtitle: str | None = None
    section_summary: str | None = None
    takeaway_title: str | None = None
    takeaway_body: str | None = None
    chunk_index: int | None = None
    chunk_start: float | None = None
    chunk_end: float | None = None
    chunk_speakers: list[str] | None = None
    score: float | None = None


def build_citations_from_hits(
    hits_with_ids: Iterable[tuple[RetrievalHit, int]],
) -> Dict[int, BaseCitation]:
    """Build citation map from hits using provided citation IDs."""
    citations: Dict[int, BaseCitation] = {}
    for hit, cid in hits_with_ids:
        citations[cid] = RagCitation(
            id=cid,
            type=hit.kind,
            entity_id=hit.entity_id,
            text=hit.text,
            source_id=hit.source_id,
            source_title=hit.source_title,
            source_type=hit.source_type,
            source_author=hit.source_author,
            source_label=hit.source_label,
            source_status=hit.source_status,
            source_published_at=hit.source_published_at,
            source_last_active_at=hit.source_last_active_at,
            section_id=hit.section_id,
            section_title=hit.section_title,
            section_subtitle=hit.section_subtitle,
            section_summary=hit.section_summary,
            takeaway_title=hit.takeaway_title,
            takeaway_body=hit.takeaway_body,
            chunk_index=hit.chunk_index,
            chunk_start=hit.chunk_start,
            chunk_end=hit.chunk_end,
            chunk_speakers=hit.chunk_speakers,
            score=hit.score,
        )
    return citations
