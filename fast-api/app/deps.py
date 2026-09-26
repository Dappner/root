"""FastAPI dependency functions for injecting initialized clients and services."""

from typing import Annotated

from fastapi import Depends

from app.clients import apple_podcasts, assemblyai, elevenlabs, embedder, object_store, youtube
from app.core.database import AsyncSessionLocal
from app.integrations.apple_podcasts import ApplePodcastsClient
from app.integrations.assemblyai import AssemblyAIClient
from app.integrations.elevenlabs import ElevenLabsClient
from app.integrations.youtube import YouTubeTranscriptClient
from app.providers.embedder import Embedder
from app.providers.object_store import ObjectStore
from app.repositories.podcast_repository import PodcastRepository
from app.repositories.source_repository import SourceRepository
from app.repositories.source_takeaway_repository import SourceTakeawayRepository
from app.repositories.video_repository import VideoRepository
from app.services.audio_transcription import (
    AudioTranscriptionService,
    get_audio_transcription_service,
)
from app.services.capture_service import CaptureService
from app.services.citation_embedding_service import CitationEmbeddingService
from app.services.citation_service import CitationService
from app.services.collection_service import CollectionService
from app.services.home_service import HomeService
from app.services.note_service import NoteService
from app.services.playback_service import PlaybackService
from app.services.podcast_library_service import PodcastLibraryService
from app.services.podcast_sync_service import PodcastSyncService
from app.services.section_summary_embedding_service import SectionSummaryEmbeddingService
from app.services.source_takeaway_service import SourceTakeawayService
from app.services.stats_service import StatsService
from app.services.suggestion_service import SuggestionService
from app.services.tag_service import TagService
from app.services.takeaway_embedding_service import TakeawayEmbeddingService
from app.services.transcript_embedding_backfill_service import TranscriptEmbeddingBackfillService
from app.services.transcript_embedding_service import TranscriptEmbeddingService
from app.services.video_import_service import VideoImportService


def get_object_store() -> ObjectStore:
    return object_store


def get_embedder() -> Embedder:
    return embedder


def get_assemblyai() -> AssemblyAIClient:
    return assemblyai


def get_youtube() -> YouTubeTranscriptClient:
    return youtube


def get_apple_podcasts() -> ApplePodcastsClient:
    return apple_podcasts


def get_elevenlabs() -> ElevenLabsClient:
    return elevenlabs


def audio_transcription_service() -> AudioTranscriptionService:
    # Delegates to the module accessor so service-to-service callers (which can't
    # use Depends) and route injection share one instance.
    return get_audio_transcription_service()


def home_service() -> HomeService:
    return HomeService()


def playback_service() -> PlaybackService:
    return PlaybackService()


def podcast_library_service() -> PodcastLibraryService:
    return PodcastLibraryService()


def podcast_sync_service() -> PodcastSyncService:
    return PodcastSyncService()


def stats_service() -> StatsService:
    return StatsService()


def video_import_service() -> VideoImportService:
    return VideoImportService()


def capture_service() -> CaptureService:
    return CaptureService()


def citation_embedding_service(
    embedder: Annotated[Embedder, Depends(get_embedder)],
) -> CitationEmbeddingService:
    return CitationEmbeddingService(embedder=embedder, session_factory=AsyncSessionLocal)


def citation_service() -> CitationService:
    return CitationService()


def collection_service() -> CollectionService:
    return CollectionService()


def note_service() -> NoteService:
    return NoteService()


def podcast_repository() -> PodcastRepository:
    return PodcastRepository()


def section_summary_embedding_service(
    embedder: Annotated[Embedder, Depends(get_embedder)],
) -> SectionSummaryEmbeddingService:
    return SectionSummaryEmbeddingService(
        embedder=embedder,
        session_factory=AsyncSessionLocal,
    )


def suggestion_service() -> SuggestionService:
    return SuggestionService()


def tag_service() -> TagService:
    return TagService()


def takeaway_embedding_service(
    embedder: Annotated[Embedder, Depends(get_embedder)],
) -> TakeawayEmbeddingService:
    return TakeawayEmbeddingService(embedder=embedder, session_factory=AsyncSessionLocal)


def takeaway_service() -> SourceTakeawayService:
    return SourceTakeawayService(repo=SourceTakeawayRepository())


def transcript_backfill_service(
    r2_client: Annotated[ObjectStore, Depends(get_object_store)],
    embedder: Annotated[Embedder, Depends(get_embedder)],
) -> TranscriptEmbeddingBackfillService:
    return TranscriptEmbeddingBackfillService(
        session_factory=AsyncSessionLocal,
        r2=r2_client,
        embedding=TranscriptEmbeddingService(embedder=embedder),
    )


def video_repository() -> VideoRepository:
    return VideoRepository()


def source_repository() -> SourceRepository:
    return SourceRepository()
