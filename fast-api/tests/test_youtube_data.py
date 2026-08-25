"""Unit tests for YouTube Data helpers (no DB, no network)."""

from __future__ import annotations

import pytest

from app.core.exceptions import ExternalServiceError
from app.integrations.youtube_data import extract_video_id, parse_iso8601_duration

_VIDEO_ID = "dQw4w9WgXcQ"


@pytest.mark.parametrize(
    "raw",
    [
        _VIDEO_ID,  # bare ID
        f"https://www.youtube.com/watch?v={_VIDEO_ID}",
        f"https://youtube.com/watch?v={_VIDEO_ID}&t=10s",
        f"https://www.youtube.com/watch?feature=share&v={_VIDEO_ID}",
        f"https://youtu.be/{_VIDEO_ID}",
        f"https://youtu.be/{_VIDEO_ID}?t=30",
        f"https://www.youtube.com/embed/{_VIDEO_ID}",
        f"https://www.youtube.com/shorts/{_VIDEO_ID}",
        f"  https://youtu.be/{_VIDEO_ID}  ",  # surrounding whitespace
    ],
)
def test_extract_video_id_valid_forms(raw: str) -> None:
    assert extract_video_id(raw) == _VIDEO_ID


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "not a url",
        "https://example.com/watch?v=abc",  # too short
        "https://vimeo.com/123456789",
        "https://www.youtube.com/watch",  # no id
        "shortid",
    ],
)
def test_extract_video_id_invalid_raises(raw: str) -> None:
    with pytest.raises(ExternalServiceError):
        extract_video_id(raw)


@pytest.mark.parametrize(
    ("duration", "expected"),
    [
        ("", 0),
        ("PT0S", 0),
        ("PT10S", 10),
        ("PT2M10S", 130),
        ("PT1H2M10S", 3730),
        ("PT1H", 3600),
        ("PT15M", 900),
        ("P1DT2H", 93600),
        ("garbage", 0),
    ],
)
def test_parse_iso8601_duration(duration: str, expected: int) -> None:
    assert parse_iso8601_duration(duration) == expected
