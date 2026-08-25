# FastAPI Backend

The application backend: all CRUD, RAG (Retrieval-Augmented Generation), AI operations, and external service integration.

## Overview

This service owns every operation the app performs — CRUD over sources/citations/captures/takeaways/notes/tags/collections/videos, plus semantic search and question-answering over user citations and captures. It uses:
- **FastAPI** for the web framework
- **PostgreSQL + pgvector** for vector storage and search
- **Voyage AI** for embeddings and reranking
- **Google Gemini** for RAG agent LLM generation (gemini-3-flash-preview)
- **OpenAI** for review item generation (gpt-4o-mini)

## Architecture

1. The frontend (via Next.js proxy / nginx) and mobile send authenticated requests to FastAPI.
2. FastAPI validates the Better-Auth JWT via JWKS and resolves the user.
3. FastAPI performs the CRUD or RAG operation against PostgreSQL / pgvector / external providers.
4. Results are returned directly, or streamed back to the client via SSE for RAG.

## Development

```bash
# Install dependencies
make install

# Set up pre-commit hooks (recommended)
make setup-hooks

# Run locally
make dev

# Or manually:
uv run uvicorn app.main:app --reload --port 8081

# Run with Docker
docker build -t rag-service .
docker run -p 8081:8081 --env-file .env rag-service
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/root

# AI Services
EMBEDDING_API_KEY=pa-xxx          # Voyage AI API key (embeddings + reranking)
GOOGLE_API_KEY=...                # Google API key (Gemini LLM + YouTube Data API)
OPENAI_API_KEY=sk-xxx             # OpenAI API key (review generation - gpt-4o-mini)

# Security
BETTER_AUTH_URL=http://localhost:3000   # Base URL for Better Auth (Next.js)
# JWKS_URL=                                # Optional: override Better Auth JWKS URL

# Server
LOG_LEVEL=INFO
APP_ENV=local  # set to staging/prod to enable JSON logs
```

Note: Models are hardcoded in the service (gemini-3-flash-preview for RAG, gpt-4o-mini for reviews).

## API Endpoints

### POST /rag-api/ask (SSE)
Ask a question and receive streaming response.

**Headers:**
- `Accept: text/event-stream`
- `Authorization: Bearer <jwt>` (Better Auth JWT from frontend)

**Request:**
```json
{
  "question": "What are the key insights about quantum computing?",
  "filters": {
    "source_ids": [1, 2, 3]
  }
}
```

**Response (SSE events):**
- `status` - Progress updates
- `hits` - Retrieved context
- `delta` - Streaming text tokens
- `done` - Final answer
- `error` - Error message

### GET /rag-api/health
Health check endpoint.

## Testing

```bash
# Run tests
uv run pytest

# Run with coverage
uv run pytest --cov=app tests/
```

## Code Quality

```bash
# Format code (fixes imports + style)
make format

# Lint code
make lint

# Type check
make typecheck

# Run pre-commit on all files (after setup-hooks)
uv run pre-commit run --all-files
```
