"""Vector search orchestration for captures, citations, takeaways, and sections."""

from __future__ import annotations

from typing import List, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients import object_store as _object_store
from app.core.logging import get_logger
from app.repositories.search_repository import SearchRepository
from app.schemas.rag import RetrievalHit
from app.services.embedding import EmbeddingService
from app.services.transcript_chunk_hydrator import TranscriptChunkHydrator

logger = get_logger(__name__)


async def vector_search(
    query: str | list[float],
    user_id: str,
    db: AsyncSession,
    embedder: EmbeddingService,
    source_ids: list[int] | None = None,
    source_types: list[str] | None = None,
    entity_types: (
        list[
            Literal["capture", "citation", "takeaway", "source_section_summary", "transcript_chunk"]
        ]
        | None
    ) = None,
    limit: int = 30,
) -> List[RetrievalHit]:
    """Vector similarity search across the knowledge base.

    Args:
        query: Query string (will be embedded) or precomputed embedding vector
        user_id: User ID for scoping searches
        db: Database session
        embedder: Embedding service for generating embeddings
        source_ids: Optional list of source IDs to filter by
        source_types: Optional list of source types to filter by
        entity_types: Optional list of entity types to search (default: all)
        limit: Limit per entity type (default: 30)

    Returns:
        List of RetrievalHit with vec_rank set, sorted by score descending
    """
    if entity_types is None:
        entity_types = [
            "capture",
            "citation",
            "takeaway",
            "source_section_summary",
            "transcript_chunk",
        ]

    search_captures = "capture" in entity_types
    search_citations = "citation" in entity_types
    search_source_sections = "source_section_summary" in entity_types
    search_takeaways = "takeaway" in entity_types
    search_transcript_chunks = "transcript_chunk" in entity_types

    if isinstance(query, list):
        embedding = query
        query_str = ""
    else:
        query_str = query
        embedding = await embedder.embed_query(query)

    logger.debug(
        f"Vector search: query='{query_str[:50] if query_str else '[precomputed]'}...', "
        f"user={user_id}, entity_types={entity_types}, sources={source_ids}, "
        f"source_types={source_types}, limit={limit}"
    )

    search_repo = SearchRepository(db)
    hits: List[RetrievalHit] = []

    if search_citations:
        try:
            citation_hits = await search_repo.vector_search_citations(
                embedding, user_id, source_ids, source_types, limit
            )
            hits.extend(citation_hits)
            logger.debug(f"Vector search citations: {len(citation_hits)} hits")
        except Exception as e:
            logger.error(f"Vector search citations failed: {e}")
            raise

    if search_captures:
        try:
            capture_hits = await search_repo.vector_search_captures(
                embedding, user_id, source_ids, source_types, limit
            )
            hits.extend(capture_hits)
            logger.debug(f"Vector search captures: {len(capture_hits)} hits")
        except Exception as e:
            logger.error(f"Vector search captures failed: {e}")
            raise

    if search_takeaways:
        try:
            takeaway_hits = await search_repo.vector_search_takeaways(
                embedding, user_id, source_ids, source_types, limit
            )
            hits.extend(takeaway_hits)
            logger.debug(f"Vector search takeaways: {len(takeaway_hits)} hits")
        except Exception as e:
            logger.error(f"Vector search takeaways failed: {e}")
            raise

    if search_source_sections:
        try:
            section_hits = await search_repo.vector_search_source_sections(
                embedding, user_id, source_ids, source_types, limit
            )
            hits.extend(section_hits)
            logger.debug(f"Vector search source sections: {len(section_hits)} hits")
        except Exception as e:
            logger.error(f"Vector search source sections failed: {e}")
            raise

    if search_transcript_chunks:
        try:
            chunk_rows = await search_repo.vector_search_transcript_chunks(
                embedding, user_id, source_ids, source_types, limit
            )
            if chunk_rows:
                hydrator = TranscriptChunkHydrator(_object_store)
                requests = [
                    (row.source_id, row.chunk_index, row.episode_id, row.video_id)
                    for row in chunk_rows
                ]
                chunk_map = await hydrator.hydrate(requests)

                for row in chunk_rows:
                    chunk = chunk_map.get((row.source_id, row.chunk_index))
                    if chunk is None:
                        continue
                    hits.append(
                        RetrievalHit(
                            kind="transcript_chunk",
                            entity_id=row.source_id,
                            text=chunk.text,
                            source_id=row.source_id,
                            source_title=row.source_title,
                            source_type=row.source_type,
                            source_author=row.source_author,
                            source_label=row.source_label,
                            source_status=row.source_status,
                            source_published_at=row.source_published_at,
                            source_last_active_at=row.source_last_active_at,
                            chunk_index=chunk.chunk_index,
                            chunk_start=chunk.start,
                            chunk_end=chunk.end,
                            chunk_speakers=chunk.speakers,
                            score=float(row.score),
                            vec_rank=row.vec_rank,
                        )
                    )
            logger.debug(f"Vector search transcript chunks: {len(chunk_rows)} hits")
        except Exception as e:
            logger.error(f"Vector search transcript chunks failed: {e}")
            raise

    hits.sort(key=lambda h: -h.score)

    logger.info(
        "Vector search complete: total=%d "
        "(captures=%d, citations=%d, takeaways=%d, sections=%d, chunks=%d)",
        len(hits),
        sum(1 for h in hits if h.kind == "capture"),
        sum(1 for h in hits if h.kind == "citation"),
        sum(1 for h in hits if h.kind == "takeaway"),
        sum(1 for h in hits if h.kind == "source_section_summary"),
        sum(1 for h in hits if h.kind == "transcript_chunk"),
    )
    return hits
