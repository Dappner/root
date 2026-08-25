"""DB-backed tests for video import + add-to-library.

Require ``TEST_DATABASE_URL``. The YouTube Data client is faked — no network.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.youtube_data import ChannelResult, VideoResult
from app.services.video_import_service import VideoImportService
from tests.conftest import OTHER_USER_ID, TEST_USER_ID

pytestmark = pytest.mark.asyncio

_PLATFORM = "youtube"
_VIDEO_PID = "dQw4w9WgXcQ"  # valid 11-char YouTube ID shape
_CHANNEL_PID = "UC_test_channel_001"


class FakeYouTubeClient:
    """Records calls and returns canned metadata."""

    def __init__(
        self,
        *,
        video: VideoResult | None = None,
        channel: ChannelResult | None = None,
    ) -> None:
        self._video = video
        self._channel = channel
        self.get_video_calls: list[str] = []
        self.get_channel_calls: list[str] = []

    async def get_video(self, video_id: str) -> VideoResult:
        self.get_video_calls.append(video_id)
        assert self._video is not None
        return self._video

    async def get_channel(self, channel_id: str) -> ChannelResult:
        self.get_channel_calls.append(channel_id)
        assert self._channel is not None
        return self._channel


def _video_result(**overrides: object) -> VideoResult:
    base = dict(
        id=_VIDEO_PID,
        title="Test Video",
        description="A description",
        channel_id=_CHANNEL_PID,
        channel_title="Test Channel",
        thumbnail_url="https://img/thumb.jpg",
        duration=372,
        view_count=12345,
        published_at=None,
    )
    base.update(overrides)
    return VideoResult(**base)  # type: ignore[arg-type]


def _channel_result(**overrides: object) -> ChannelResult:
    base = dict(
        id=_CHANNEL_PID,
        title="Test Channel",
        description="Channel desc",
        thumbnail_url="https://img/chan.jpg",
        custom_url="@testchannel",
        subscriber_count=1000,
        video_count=50,
    )
    base.update(overrides)
    return ChannelResult(**base)  # type: ignore[arg-type]


async def _wipe(db: AsyncSession) -> None:
    users = [TEST_USER_ID, OTHER_USER_ID]
    await db.execute(
        text(
            "DELETE FROM rag_embeddings WHERE source_id IN "
            "(SELECT id FROM sources WHERE user_id = ANY(:u))"
        ).bindparams(u=users)
    )
    await db.execute(text("DELETE FROM sources WHERE user_id = ANY(:u)").bindparams(u=users))
    await db.execute(text("DELETE FROM videos WHERE platform_id = :p").bindparams(p=_VIDEO_PID))
    await db.execute(text("DELETE FROM channels WHERE platform_id = :p").bindparams(p=_CHANNEL_PID))
    await db.commit()


@pytest_asyncio.fixture(autouse=True)
async def _clean(db: AsyncSession) -> AsyncGenerator[None, None]:
    await _wipe(db)
    yield
    await _wipe(db)


async def test_import_creates_video_and_channel(db: AsyncSession) -> None:
    fake = FakeYouTubeClient(video=_video_result(), channel=_channel_result())
    service = VideoImportService(youtube=fake)  # type: ignore[arg-type]

    video = await service.import_youtube_video(db, f"https://youtu.be/{_VIDEO_PID}")
    await db.commit()

    assert video.platform == _PLATFORM
    assert video.platform_id == _VIDEO_PID
    assert video.title == "Test Video"
    assert video.duration == 372
    assert video.embed_url == f"https://www.youtube.com/embed/{_VIDEO_PID}"
    assert video.transcript_status == "none"
    assert video.channel_id is not None
    assert fake.get_video_calls == [_VIDEO_PID]
    assert fake.get_channel_calls == [_CHANNEL_PID]


async def test_import_short_circuits_when_video_exists(db: AsyncSession) -> None:
    fake = FakeYouTubeClient(video=_video_result(), channel=_channel_result())
    service = VideoImportService(youtube=fake)  # type: ignore[arg-type]

    first = await service.import_youtube_video(db, _VIDEO_PID)
    await db.commit()

    # Second import with a fresh fake that would error if the API were called.
    boom = FakeYouTubeClient(video=None, channel=None)
    service2 = VideoImportService(youtube=boom)  # type: ignore[arg-type]
    second = await service2.import_youtube_video(db, _VIDEO_PID)

    assert second.id == first.id
    assert boom.get_video_calls == []  # short-circuited, no API call


async def test_import_tolerates_channel_failure(db: AsyncSession) -> None:
    from app.core.exceptions import ExternalServiceError

    class FailChannelClient(FakeYouTubeClient):
        async def get_channel(self, channel_id: str) -> ChannelResult:
            self.get_channel_calls.append(channel_id)
            raise ExternalServiceError("youtube", "boom")

    fake = FailChannelClient(video=_video_result())
    service = VideoImportService(youtube=fake)  # type: ignore[arg-type]

    video = await service.import_youtube_video(db, _VIDEO_PID)
    await db.commit()

    assert video.channel_id is None  # imported without channel link
    assert fake.get_channel_calls == [_CHANNEL_PID]


async def test_add_to_library_create_path(db: AsyncSession) -> None:
    fake = FakeYouTubeClient(video=_video_result(), channel=_channel_result())
    service = VideoImportService(youtube=fake)  # type: ignore[arg-type]

    imported = await service.import_youtube_video(db, _VIDEO_PID)
    await db.commit()

    source, should_ingest = await service.add_to_library(db, TEST_USER_ID, imported.id)
    await db.commit()

    assert should_ingest is True
    assert source.type == "video"
    assert source.status == "todo"
    assert source.title == "Test Video"
    assert source.author == "Test Channel"
    assert source.video_id == imported.id
    # Video hydration.
    assert source.duration == 372
    assert source.image_url == "https://img/thumb.jpg"
    assert source.media_url == f"https://www.youtube.com/embed/{_VIDEO_PID}"
    assert source.source_url == f"https://www.youtube.com/watch?v={_VIDEO_PID}"


async def test_add_to_library_update_path(db: AsyncSession) -> None:
    fake = FakeYouTubeClient(video=_video_result(), channel=_channel_result())
    service = VideoImportService(youtube=fake)  # type: ignore[arg-type]

    imported = await service.import_youtube_video(db, _VIDEO_PID)
    await db.commit()

    first, _ = await service.add_to_library(db, TEST_USER_ID, imported.id)
    await db.commit()

    second, _ = await service.add_to_library(db, TEST_USER_ID, imported.id)
    await db.commit()

    # Same source row reused, not duplicated.
    assert second.id == first.id
    count = (
        await db.execute(
            text("SELECT COUNT(*) FROM sources WHERE user_id = :u AND video_id = :v").bindparams(
                u=TEST_USER_ID, v=imported.id
            )
        )
    ).scalar_one()
    assert count == 1


async def test_add_to_library_missing_video_raises(db: AsyncSession) -> None:
    from app.core.exceptions import NotFoundError

    fake = FakeYouTubeClient()
    service = VideoImportService(youtube=fake)  # type: ignore[arg-type]

    with pytest.raises(NotFoundError):
        await service.add_to_library(db, TEST_USER_ID, 999_999_999)
