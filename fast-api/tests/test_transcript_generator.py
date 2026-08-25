from unittest.mock import AsyncMock, MagicMock

import pytest

from app.integrations.assemblyai import _format_transcript
from app.services.transcript_generator import TranscriptGenerator


@pytest.fixture
def mock_session_factory():
    return MagicMock()


@pytest.fixture
def mock_r2_client():
    return MagicMock()


@pytest.fixture
def mock_assemblyai_client():
    client = MagicMock()
    client.is_configured = True
    return client


@pytest.fixture
def generator(mock_session_factory, mock_r2_client, mock_assemblyai_client):
    return TranscriptGenerator(
        mock_session_factory,
        mock_r2_client,
        mock_assemblyai_client,
    )


def test_format_transcript():
    mock_transcript = MagicMock()
    mock_transcript.text = "Hello world. This is a test."
    mock_transcript.id = "test_id"
    mock_transcript.audio_duration = 120.5
    mock_transcript.confidence = 0.95

    utterance = MagicMock()
    utterance.text = "Hello world."
    utterance.start = 1000
    utterance.end = 2000
    utterance.confidence = 0.985
    utterance.speaker = "A"

    mock_transcript.utterances = [utterance]

    result = _format_transcript(mock_transcript)

    assert result["full_text"] == "Hello world. This is a test."
    assert len(result["utterances"]) == 1
    assert result["utterances"][0]["text"] == "Hello world."
    assert result["utterances"][0]["start"] == 1.0
    assert result["utterances"][0]["end"] == 2.0
    assert result["utterances"][0]["speaker"] == "A"

    assert "A" in result["speakers"]
    assert result["speakers"]["A"]["utterance_count"] == 1
    assert result["metadata"]["id"] == "test_id"
    assert result["metadata"]["audio_duration"] == 120.5


class _Result:
    def __init__(self, rowcount: int):
        self.rowcount = rowcount


@pytest.mark.asyncio
async def test_backfill_citation_sections_counts_av_books_and_captures(generator):
    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[
            _Result(2),
            _Result(3),
            _Result(4),
            _Result(1),
        ]
    )
    db.flush = AsyncMock()

    result = await generator.backfill_citation_sections(db)

    assert result == {"citations_updated": 5, "captures_updated": 5}
    assert db.execute.call_count == 4
    # The service flushes and lets the request's get_db boundary commit; it must
    # not commit the transaction itself.
    db.flush.assert_called_once()
