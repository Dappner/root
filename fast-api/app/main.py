"""Main FastAPI application."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import logfire
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    audio,
    captures,
    citations,
    collections,
    graph,
    health,
    home,
    me,
    notes,
    playback,
    podcasts,
    rag,
    sections,
    sources,
    suggestions,
    tags,
    takeaways,
    transcript,
    videos,
    voice,
)
from app.core.config import settings
from app.core.error_handlers import register_error_handlers
from app.core.logging import get_logger, setup_logging
from app.core.openapi import install_openapi
from app.core.streaming.ask_run_store import ask_run_store
from app.core.streaming.reflect_session_store import reflect_session_store

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    settings.validate_startup_config()
    reflect_session_store.start_sweep()
    ask_run_store.start_sweep()
    logger.info("Starting RAG service")
    yield
    reflect_session_store.stop_sweep()
    ask_run_store.stop_sweep()
    logger.info("Shutting down RAG service")


app = FastAPI(
    title="Root RAG Service",
    description="Python microservice for RAG (Retrieval-Augmented Generation)",
    version="2.0.0",
    lifespan=lifespan,
)
install_openapi(app)

logfire.instrument_fastapi(
    app,
    excluded_urls=r".*/rag-api/health",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
register_error_handlers(app)


# Include routers under /rag-api
app.include_router(health.router, prefix="/rag-api")
app.include_router(admin.router, prefix="/rag-api")
app.include_router(audio.router, prefix="/rag-api")
app.include_router(captures.router, prefix="/rag-api")
app.include_router(citations.router, prefix="/rag-api")
app.include_router(collections.router, prefix="/rag-api")
app.include_router(graph.router, prefix="/rag-api")
app.include_router(home.router, prefix="/rag-api")
app.include_router(me.router, prefix="/rag-api")
app.include_router(notes.router, prefix="/rag-api")
app.include_router(playback.router, prefix="/rag-api")
app.include_router(podcasts.router, prefix="/rag-api")
app.include_router(sections.router, prefix="/rag-api")
app.include_router(sources.router, prefix="/rag-api")
app.include_router(rag.router, prefix="/rag-api")
app.include_router(suggestions.router, prefix="/rag-api")
app.include_router(tags.router, prefix="/rag-api")
app.include_router(takeaways.router, prefix="/rag-api")
app.include_router(transcript.router, prefix="/rag-api")
app.include_router(videos.router, prefix="/rag-api")
app.include_router(voice.router, prefix="/rag-api")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "service": "Root RAG Service",
        "version": "1.0.0",
        "status": "running",
    }
