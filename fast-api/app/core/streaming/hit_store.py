"""Shared storage for retrieval hits across actions."""

from __future__ import annotations

from math import inf
from typing import Dict, Iterable, List, Optional, Tuple

from app.schemas.rag import RetrievalHit


class HitStore:
    """Collects hits across actions, dedupes by (kind, entity_id),
    and assigns stable citation IDs."""

    def __init__(self) -> None:
        self._hits_by_key: Dict[str, RetrievalHit] = {}
        self._cid_by_key: Dict[str, int] = {}

    def _make_key(self, hit: RetrievalHit) -> str:
        if hit.kind == "transcript_chunk" and hit.source_id is not None:
            return f"{hit.kind}:{hit.source_id}:{hit.chunk_index}"
        return f"{hit.kind}:{hit.entity_id}"

    def _is_better(self, candidate: RetrievalHit, current: Optional[RetrievalHit]) -> bool:
        """Pick the better hit when duplicates appear; prefer higher score, then better ranks."""

        def rank_key(hit: RetrievalHit) -> Tuple[float, float, float]:
            # Lower is better for this tuple.
            score_key = -hit.score if hit.score is not None else inf  # higher score preferred
            vec_key = hit.vec_rank if hit.vec_rank is not None else inf  # lower rank preferred
            fts_key = hit.fts_rank if hit.fts_rank is not None else inf  # lower rank preferred
            return (score_key, vec_key, fts_key)

        if current is None:
            return True

        return rank_key(candidate) < rank_key(current)

    def register_hits(
        self, hits: Iterable[RetrievalHit], citation_start: int
    ) -> List[Tuple[RetrievalHit, int]]:
        """
        Merge hits into the store, assign stable citation IDs, and return annotated hits.

        Returns:
            List of (hit, citation_id) tuples using canonical IDs per (kind, entity_id).
        """
        annotated: List[Tuple[RetrievalHit, int]] = []
        seen_in_batch: set[str] = set()
        next_cid = citation_start

        for hit in hits:
            key = self._make_key(hit)
            if key in seen_in_batch:
                continue
            seen_in_batch.add(key)
            cid = self._cid_by_key.get(key)
            include = False

            if cid is None:
                cid = next_cid
                next_cid += 1
                self._cid_by_key[key] = cid
                self._hits_by_key[key] = hit
                include = True
            else:
                stored = self._hits_by_key.get(key)
                if self._is_better(hit, stored):
                    self._hits_by_key[key] = hit
                    include = True

            if include:
                annotated.append((self._hits_by_key[key], cid))

        return annotated

    def all_hits(self) -> List[RetrievalHit]:
        """Return the deduped set of hits recorded so far."""
        return list(self._hits_by_key.values())

    def all_hits_with_ids(self) -> List[Tuple[RetrievalHit, int]]:
        """Return all recorded hits paired with their canonical citation IDs."""
        annotated: List[Tuple[RetrievalHit, int]] = []
        for key, hit in self._hits_by_key.items():
            cid = self._cid_by_key.get(key)
            if cid is not None:
                annotated.append((hit, cid))
        return annotated
