"""Embedding + rerank provider seam."""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from app.core.config import Settings

EMBEDDING_DIM = 1024  # matches rag_embeddings.embedding vector(1024)


@dataclass(frozen=True)
class RerankResult:
    index: int  # position in the documents passed to rerank()
    score: float


class Embedder(Protocol):
    """What services need from an embedding provider.

    Document and query embeddings must come from the same model (same vector
    space). Implementations raise on provider failure; callers decide whether
    that is fatal.
    """

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        """One vector per text, in input order."""
        ...

    async def embed_query(self, text: str) -> list[float]: ...

    async def rerank(self, query: str, documents: Sequence[str]) -> list[RerankResult]:
        """Relevance for every document, highest score first."""
        ...


_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class FakeEmbedder:
    """Deterministic, offline Embedder for tests and local verification.

    Vectors are hashed bag-of-words (L2-normalised), so texts sharing words are
    close and hybrid search behaves plausibly. Rerank scores by query-token
    overlap. ``calls`` records every operation and its inputs for assertions.
    """

    def __init__(self, dim: int = EMBEDDING_DIM) -> None:
        self.dim = dim
        self.calls: list[tuple[str, list[str]]] = []

    def _vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for tok in _tokens(text) or ["<empty>"]:
            digest = hashlib.sha256(tok.encode()).digest()
            idx = int.from_bytes(digest[:4], "little") % self.dim
            vec[idx] += 1.0 if digest[4] & 1 else -1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        self.calls.append(("embed_documents", list(texts)))
        return [self._vector(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        self.calls.append(("embed_query", [text]))
        return self._vector(text)

    async def rerank(self, query: str, documents: Sequence[str]) -> list[RerankResult]:
        self.calls.append(("rerank", list(documents)))
        q = set(_tokens(query))
        scored = [
            RerankResult(index=i, score=len(q & set(_tokens(doc))) / (len(q) or 1))
            for i, doc in enumerate(documents)
        ]
        return sorted(scored, key=lambda r: r.score, reverse=True)


def create_embedder(settings: Settings) -> Embedder:
    """Build the configured Embedder (``EMBEDDING_PROVIDER``: voyage | fake)."""
    if settings.embedding_provider == "fake":
        return FakeEmbedder()
    if settings.embedding_provider == "voyage":
        from app.integrations.voyage import VoyageEmbedder

        return VoyageEmbedder(
            api_key=settings.embedding_api_key,
            model=settings.embedding_model,
            base_url=settings.embedding_base_url or None,
        )
    raise ValueError(f"unknown EMBEDDING_PROVIDER: {settings.embedding_provider!r}")
