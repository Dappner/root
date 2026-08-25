"""Embedding service wrapper for Voyage AI."""

from __future__ import annotations

from typing import List

from app.core.config import settings
from app.core.logging import get_logger
from app.integrations.voyage import VoyageClient
from app.schemas.rag import RetrievalHit

logger = get_logger(__name__)


class EmbeddingService:
    """Thin async wrapper around Voyage AI embeddings."""

    def __init__(self, client: VoyageClient):
        self.client = client

    async def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a query using Voyage AI."""
        logger.debug(f"Generating embedding for query: '{query[:100]}...'")
        result = await self.client.embed(
            texts=[query],
            model=settings.embedding_model,
            input_type="query",
        )
        embedding = result.embeddings[0]
        logger.debug(f"Embedding generated, dimension={len(embedding)}")
        return [float(x) for x in embedding]

    async def rerank_hits(
        self,
        query: str,
        hits: list[RetrievalHit],
        top_k: int = 40,
    ) -> list[RetrievalHit]:
        """Rerank hits using Voyage reranker (keeps tail as-is)."""
        if not hits:
            return hits

        k = min(top_k, len(hits))
        candidates = hits[:k]

        # Contextual Reranking: Construct rich documents with metadata
        documents: list[str] = []
        valid_candidates: list[RetrievalHit] = []

        for h in candidates:
            # Safety check: skip hits with no text content
            if not h.text or not h.text.strip():
                logger.warning(f"Skipping hit {h.kind}:{h.entity_id} with empty text")
                continue

            parts: list[str] = []

            # 1. Source Metadata
            if h.source_title:
                meta = f"Source: {h.source_title}"
                if h.source_type:
                    meta += f" ({h.source_type})"
                parts.append(meta)
            if h.source_author:
                parts.append(f"Source author: {h.source_author}")
            if h.source_label:
                parts.append(f"Source label: {h.source_label}")
            if h.source_status:
                parts.append(f"Source status: {h.source_status}")
            if h.source_published_at:
                parts.append(f"Source published: {h.source_published_at}")

            # 2. Content & Context based on Kind
            if h.kind == "citation":
                if h.citation_speaker:
                    parts.append(f"Speaker: {h.citation_speaker}")
                if h.citation_context:
                    parts.append(f"Context: {h.citation_context}")
                parts.append(f"Text: {h.text}")

            elif h.kind == "capture":
                parts.append(f"Note: {h.text}")
                if h.citation_text:
                    ref_parts = ["Reference:"]
                    if h.citation_speaker:
                        ref_parts.append(f"(Speaker: {h.citation_speaker})")
                    ref_parts.append(h.citation_text)
                    parts.append(" ".join(ref_parts))

            elif h.kind == "takeaway":
                if h.takeaway_title:
                    parts.append(f"Key Takeaway: {h.takeaway_title}")
                if h.takeaway_body:
                    parts.append(f"Insight: {h.takeaway_body}")

            elif h.kind == "source_section_summary":
                if h.section_title:
                    parts.append(f"Section: {h.section_title}")
                if h.section_subtitle:
                    parts.append(f"Subtitle: {h.section_subtitle}")
                if h.section_summary:
                    parts.append(f"Summary: {h.section_summary}")
                else:
                    parts.append(f"Summary: {h.text}")

            # Safety check: ensure document has content
            doc = " | ".join(parts)
            if doc.strip():
                documents.append(doc)
                valid_candidates.append(h)
            else:
                logger.warning(f"Skipping hit {h.kind}:{h.entity_id} with empty document string")

        # If no valid documents after filtering, fall back to original hits
        if not documents:
            logger.warning("No valid documents to rerank after filtering; returning original hits")
            return hits

        logger.info(
            f"Reranking {len(documents)} valid hit(s) "
            f"(requested top_k={top_k}, total={len(hits)}, filtered out={k - len(documents)})"
        )

        try:
            result = await self.client.rerank(
                query=query,
                documents=documents,
                model="rerank-2.5",
                top_k=len(documents),  # Use actual number of valid documents
            )

            reranked: list[RetrievalHit] = []
            # Sort by relevance score descending in case API does not guarantee order
            for item in sorted(result.results, key=lambda r: r.relevance_score, reverse=True):
                idx = item.index
                if idx < len(valid_candidates):
                    hit = valid_candidates[idx].model_copy()
                    hit.score = item.relevance_score
                    reranked.append(hit)

            # Preserve any remaining hits beyond top_k in original order
            if k < len(hits):
                reranked.extend(hits[k:])

            logger.info(f"Reranking successful: {len(reranked)} hit(s) returned")
            return reranked

        except Exception as e:
            logger.warning(f"Reranking failed for query '{query[:50]}...': {e}", exc_info=True)
            return hits
