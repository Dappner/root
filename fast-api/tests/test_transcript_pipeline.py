"""Behavior tests for the transcript generation state machine.

Runs the same scenarios against both the podcast and video generators (their
pipelines are intentionally identical), pinning: not-found handling, the
pending short-circuit, the already-transcribed short-circuit, prerequisite
failures, the happy path (pending + background task scheduled), the
background-failure path (status set to failed with truncated error), and the
get_transcript_content status ladder. No database or network involved.
"""

from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import BackgroundTasks

from app.core.exceptions import NotFoundError, ValidationError
from app.services.transcript_generator import MAX_ERROR_LENGTH, TranscriptGenerator
from app.services.video_transcript_generator import VideoTranscriptGenerator

ENTITY_ID = 42


def _r2(available: bool = True) -> MagicMock:
    r2 = MagicMock()
    r2.is_available.return_value = available
    r2.get_public_url.side_effect = lambda key: f"https://r2.example/{key}"
    return r2


def _db() -> MagicMock:
    db = MagicMock()
    db.commit = AsyncMock()
    return db


@dataclass
class Kind:
    """Per-media wiring so every scenario can run against both generators."""

    name: str
    r2_prefix: str
    get_locked: str  # repo method used by generate_transcript
    get: str  # repo method used by status/content
    update_status: str  # repo method used by background status updates

    def make_entity(self, status: str = "none") -> SimpleNamespace:
        if self.name == "episode":
            return SimpleNamespace(
                transcript_status=status,
                transcript_error=None,
                enclosure_url="https://feeds.example/audio.mp3",
            )
        return SimpleNamespace(
            transcript_status=status,
            transcript_error=None,
            platform="youtube",
            platform_id="yt-abc",
        )

    def make_generator(self, r2: MagicMock) -> Any:
        if self.name == "episode":
            assemblyai = MagicMock()
            assemblyai.is_configured = True
            assemblyai.transcribe = AsyncMock()
            return TranscriptGenerator(MagicMock(), r2, assemblyai)
        youtube = MagicMock()
        youtube.fetch_transcript = AsyncMock()
        return VideoTranscriptGenerator(MagicMock(), r2, youtube)


KINDS = [
    Kind(
        name="episode",
        r2_prefix="podcasts",
        get_locked="get_episode_locked",
        get="get_episode",
        update_status="update_episode_status",
    ),
    Kind(
        name="video",
        r2_prefix="videos",
        get_locked="get_video_locked",
        get="get_video",
        update_status="update_video_status",
    ),
]
KIND_IDS = [k.name for k in KINDS]


def _stub_repo(generator: Any, kind: Kind, entity: SimpleNamespace | None) -> MagicMock:
    repo = MagicMock()
    getattr(repo, kind.get_locked).side_effect = None
    setattr(repo, kind.get_locked, AsyncMock(return_value=entity))
    setattr(repo, kind.get, AsyncMock(return_value=entity))
    setattr(repo, kind.update_status, AsyncMock())
    generator._repo = repo
    return repo


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.asyncio
async def test_generate_raises_not_found(kind: Kind) -> None:
    generator = kind.make_generator(_r2())
    _stub_repo(generator, kind, entity=None)

    with pytest.raises(NotFoundError):
        await generator.generate_transcript(ENTITY_ID, _db(), BackgroundTasks())


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.asyncio
async def test_generate_short_circuits_when_pending(kind: Kind) -> None:
    generator = kind.make_generator(_r2())
    _stub_repo(generator, kind, kind.make_entity(status="pending"))
    tasks = BackgroundTasks()

    result = await generator.generate_transcript(ENTITY_ID, _db(), tasks)

    assert result == {"status": "pending", "url": None}
    assert tasks.tasks == []


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.parametrize("status", ["transcribed", "embedded"])
@pytest.mark.asyncio
async def test_generate_returns_existing_transcript(kind: Kind, status: str) -> None:
    generator = kind.make_generator(_r2())
    _stub_repo(generator, kind, kind.make_entity(status=status))
    tasks = BackgroundTasks()

    result = await generator.generate_transcript(ENTITY_ID, _db(), tasks)

    expected_url = f"https://r2.example/{kind.r2_prefix}/{ENTITY_ID}/transcript.json"
    assert result == {"status": status, "url": expected_url}
    assert tasks.tasks == []


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.asyncio
async def test_generate_fails_when_r2_unavailable(kind: Kind) -> None:
    generator = kind.make_generator(_r2(available=False))
    entity = kind.make_entity()
    _stub_repo(generator, kind, entity)
    db = _db()
    tasks = BackgroundTasks()

    result = await generator.generate_transcript(ENTITY_ID, db, tasks)

    assert result == {"status": "failed", "url": None}
    assert entity.transcript_status == "failed"
    assert entity.transcript_error
    db.commit.assert_awaited()
    assert tasks.tasks == []


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.asyncio
async def test_generate_happy_path_schedules_background_task(kind: Kind) -> None:
    generator = kind.make_generator(_r2())
    entity = kind.make_entity()
    _stub_repo(generator, kind, entity)
    db = _db()
    tasks = BackgroundTasks()

    result = await generator.generate_transcript(ENTITY_ID, db, tasks)

    assert result == {"status": "pending", "url": None}
    assert entity.transcript_status == "pending"
    assert entity.transcript_error is None
    db.commit.assert_awaited()
    assert len(tasks.tasks) == 1


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.asyncio
async def test_process_failure_marks_failed_with_truncated_error(kind: Kind) -> None:
    generator = kind.make_generator(_r2())
    repo = _stub_repo(generator, kind, kind.make_entity())

    long_error = "boom " * 200
    if kind.name == "episode":
        generator._archive_audio_to_r2 = AsyncMock(return_value=None)
        generator.assemblyai_client.transcribe = AsyncMock(side_effect=RuntimeError(long_error))
        await generator._process_transcript(ENTITY_ID, "https://feeds.example/audio.mp3")
    else:
        generator.youtube_client.fetch_transcript = AsyncMock(
            side_effect=RuntimeError(long_error)
        )
        await generator._process_transcript(ENTITY_ID, "yt-abc")

    update = getattr(repo, kind.update_status)
    update.assert_awaited()
    args = update.await_args.args
    kwargs = update.await_args.kwargs
    status_value = kwargs.get("status", args[2] if len(args) > 2 else None)
    assert status_value == "failed"
    assert kwargs["error"] is not None
    assert len(kwargs["error"]) <= MAX_ERROR_LENGTH


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.parametrize("status", ["none", "pending", "failed"])
@pytest.mark.asyncio
async def test_get_content_rejects_not_ready_statuses(kind: Kind, status: str) -> None:
    generator = kind.make_generator(_r2())
    _stub_repo(generator, kind, kind.make_entity(status=status))

    with pytest.raises(ValidationError):
        await generator.get_transcript_content(ENTITY_ID, _db())


@pytest.mark.parametrize("kind", KINDS, ids=KIND_IDS)
@pytest.mark.asyncio
async def test_get_status_reports_url_only_when_ready(kind: Kind) -> None:
    generator = kind.make_generator(_r2())
    _stub_repo(generator, kind, kind.make_entity(status="none"))
    result = await generator.get_transcript_status(ENTITY_ID, _db())
    assert result == {"status": "none", "url": None}

    _stub_repo(generator, kind, kind.make_entity(status="embedded"))
    result = await generator.get_transcript_status(ENTITY_ID, _db())
    assert result["url"] == f"https://r2.example/{kind.r2_prefix}/{ENTITY_ID}/transcript.json"
