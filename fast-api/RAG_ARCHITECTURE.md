# RAG Architecture (conceptual overview)

## Components
- **Chunk store**: captures (user notes) and citations (source highlights) persisted in Postgres.
  - **Vector**: Embeddings live in `rag_embeddings` (pgvector).
  - **Lexical**: BM25 indexes via `pg_search` (ParadeDB).
- **Retriever (hybrid)**: query → semantic embedding (vector search) + keyword query (BM25) → reciprocal-rank fusion → cross-encoder rerank → top-K context.
- **Agent**: Jetflow agent orchestrates multiple search actions (captures, citations, all, within-source). Tools are cheap; agent is encouraged to try multiple searches and refinements before answering.
- **Generator**: LLM consumes reranked context and streams an answer with citation tags; only retrieved snippets may be used.

## Request flow
1) Client calls `/rag-api/ask` with question (and optional filters).
2) Agent runs: chooses a search action, calls hybrid retriever, inspects hits, may try more searches (broaden/narrow/by source), then writes the answer citing hits.
3) Service streams events: status → hits → deltas → done (answer + citations).

## Retrieval strategy
- **Semantic leg**: pgvector similarity on embeddings (`<=>` distance).
- **Lexical leg**: BM25 via `pg_search` (ParadeDB) using the `@@@` operator.
- **Fusion**: RRF on ranks from both legs.
- **Reranking (Contextual)**:
  - Cross-encoder rerank on fused results.
  - **Enrichment**: Reranker sees "Rich Documents" (e.g., `Speaker: ... | Context: ... | Text: ...`) rather than just raw text, utilizing `context` and `speaker` fields to improve relevance scoring.
  - Return top-K for the model.

## Search heuristics (agent prompts)
- Start with the most relevant tool (captures vs citations vs all).
- If results are thin, try at least two more searches (different tool or reformulated query).
- Use source-specific search when a source is implied; list sources to find IDs.
- Always cite retrieved snippets; never invent content.

## Extensibility
- Add metadata filters (source/type/time) before retrieval.
- Add query bifurcation (keyword vs semantic) and ID/phrase detection to improve BM25 coverage.
- Swap reranker/embedding models as needed; fusion stays unchanged.
