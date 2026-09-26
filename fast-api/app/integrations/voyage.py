"""Voyage AI implementation of the Embedder provider."""

from __future__ import annotations

from collections.abc import Sequence

from voyageai.client_async import AsyncClient

from app.providers.embedder import RerankResult

RERANK_MODEL = "rerank-2.5"


class VoyageEmbedder:
    """Embedder backed by Voyage embeddings + reranker."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        rerank_model: str = RERANK_MODEL,
        base_url: str | None = None,
    ) -> None:
        self._client = AsyncClient(api_key=api_key, base_url=base_url)
        self._model = model
        self._rerank_model = rerank_model

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        result = await self._client.embed(
            texts=list(texts), model=self._model, input_type="document"
        )
        return [[float(x) for x in vec] for vec in result.embeddings]

    async def embed_query(self, text: str) -> list[float]:
        result = await self._client.embed(texts=[text], model=self._model, input_type="query")
        return [float(x) for x in result.embeddings[0]]

    async def rerank(self, query: str, documents: Sequence[str]) -> list[RerankResult]:
        result = await self._client.rerank(
            query=query,
            documents=list(documents),
            model=self._rerank_model,
            top_k=len(documents),
        )
        return sorted(
            (RerankResult(index=r.index, score=r.relevance_score) for r in result.results),
            key=lambda r: r.score,
            reverse=True,
        )
