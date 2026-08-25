"""Tests for VoiceSuggestionMatcher's structured-output contract.

`match()` uses the OpenAI client's native structured-output mode
(`client.extract(schema=VoiceSuggestionMatch, ...)`), which constrains
generation to the schema at decode time. This pins down that the matcher returns
the extracted model directly and surfaces a clear error if extraction yields no
structured result. The previous agent/tool-call path let reasoning models
sidestep the tool and answer in prose (parsed=None), which this approach removes.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.voice_suggestion_matcher import (
    MatchCapture,
    MatchCitation,
    VoiceSuggestionMatch,
    VoiceSuggestionMatcher,
)

CANDIDATES = [{"index": 0, "start": 0.0, "end": 2.0, "text": "some utterance", "speaker": "A"}]


def _match() -> VoiceSuggestionMatch:
    return VoiceSuggestionMatch(
        action="create_entities",
        confidence=0.9,
        citations=[
            MatchCitation(
                utterance_start_idx=0,
                utterance_end_idx=0,
                citation_text="some utterance",
            )
        ],
        captures=[],
        reasoning_summary="matched the quote",
    )


@pytest.fixture
def matcher() -> VoiceSuggestionMatcher:
    # Avoid touching the real LLM client during construction. The matcher asserts
    # the client is an AsyncOpenAIClient, so hand it a spec'd mock of that type.
    from jetflow.clients.openai import AsyncOpenAIClient

    fake_client = MagicMock(spec=AsyncOpenAIClient)
    with patch(
        "app.services.voice_suggestion_matcher.create_llm_client",
        return_value=fake_client,
    ):
        return VoiceSuggestionMatcher("test-key")


@pytest.mark.asyncio
async def test_returns_extracted_match(matcher):
    """Happy path: extract() yields a VoiceSuggestionMatch -> returned as-is."""
    expected = _match()
    matcher.client.extract = AsyncMock(return_value=expected)

    result = await matcher.match(
        voice_transcript="this part about trade was great",
        playback_position_seconds=120.0,
        candidate_utterances=CANDIDATES,
    )

    assert result is expected


@pytest.mark.asyncio
async def test_passes_schema_and_prompts_to_extract(matcher):
    """match() drives the native structured-output path with the right inputs."""
    from app.services.voice_suggestion_matcher import VOICE_SUGGESTION_SYSTEM_PROMPT

    matcher.client.extract = AsyncMock(return_value=_match())

    await matcher.match(
        voice_transcript="trade was the best segment",
        playback_position_seconds=42.0,
        candidate_utterances=CANDIDATES,
    )

    matcher.client.extract.assert_awaited_once()
    kwargs = matcher.client.extract.await_args.kwargs
    assert kwargs["schema"] is VoiceSuggestionMatch
    assert kwargs["system_prompt"] == VOICE_SUGGESTION_SYSTEM_PROMPT
    # The transcript flows into the user-facing query.
    assert "trade was the best segment" in kwargs["query"]


@pytest.mark.asyncio
async def test_no_structured_result_raises_value_error(matcher):
    """extract() returning None (refusal / truncation) -> clear ValueError."""
    matcher.client.extract = AsyncMock(return_value=None)

    with pytest.raises(ValueError) as exc_info:
        await matcher.match(
            voice_transcript="some note",
            playback_position_seconds=10.0,
            candidate_utterances=CANDIDATES,
        )

    assert "no structured result" in str(exc_info.value)


@pytest.mark.asyncio
async def test_empty_transcript_raises_before_llm(matcher):
    matcher.client.extract = AsyncMock()

    with pytest.raises(ValueError, match="transcript is empty"):
        await matcher.match(
            voice_transcript="   ",
            playback_position_seconds=10.0,
            candidate_utterances=CANDIDATES,
        )

    matcher.client.extract.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_candidates_raises_before_llm(matcher):
    matcher.client.extract = AsyncMock()

    with pytest.raises(ValueError, match="No transcript candidates"):
        await matcher.match(
            voice_transcript="some note",
            playback_position_seconds=10.0,
            candidate_utterances=[],
        )

    matcher.client.extract.assert_not_awaited()


def _citation(start: int, end: int) -> MatchCitation:
    return MatchCitation(
        utterance_start_idx=start,
        utterance_end_idx=end,
        citation_text=f"quote {start}-{end}",
    )


def test_overlapping_citations_rejected():
    """Transcript highlights cannot overlap: two citations sharing an utterance
    fail validation so the non-overlap invariant holds before the DB/UI."""
    with pytest.raises(ValueError, match="overlap"):
        VoiceSuggestionMatch(
            action="create_entities",
            confidence=0.9,
            # [2, 5] and [4, 6] share utterances 4 and 5.
            citations=[_citation(2, 5), _citation(4, 6)],
            captures=[],
            reasoning_summary="two overlapping quotes",
        )


def test_touching_citations_rejected():
    """A citation that starts on the previous one's end utterance overlaps."""
    with pytest.raises(ValueError, match="overlap"):
        VoiceSuggestionMatch(
            action="create_entities",
            confidence=0.9,
            # [2, 4] and [4, 6] both include utterance 4.
            citations=[_citation(2, 4), _citation(4, 6)],
            captures=[],
            reasoning_summary="quotes sharing one utterance",
        )


def test_disjoint_citations_allowed():
    """Adjacent-but-disjoint ranges are fine — they share no utterance."""
    match = VoiceSuggestionMatch(
        action="create_entities",
        confidence=0.9,
        # [2, 3] and [4, 6] are back-to-back but disjoint.
        citations=[_citation(2, 3), _citation(4, 6)],
        captures=[],
        reasoning_summary="two distinct quotes",
    )
    assert len(match.citations) == 2


def test_overlap_check_order_independent():
    """Overlap is detected regardless of citation ordering in the array."""
    with pytest.raises(ValueError, match="overlap"):
        VoiceSuggestionMatch(
            action="create_entities",
            confidence=0.9,
            # Out of order: [10, 12] then [8, 11] — [8,11] overlaps [10,12].
            citations=[_citation(10, 12), _citation(8, 11)],
            captures=[],
            reasoning_summary="overlap with reversed order",
        )


def test_exact_duplicate_citations_are_merged():
    """The matcher LLM reliably emits the same single-line citation twice for a
    note with two thoughts about one moment. Exact-duplicate ranges collapse into
    one citation instead of failing the whole suggestion."""
    match = VoiceSuggestionMatch(
        action="create_entities",
        confidence=0.94,
        # The real prod failure shape: [53, 53] twice.
        citations=[_citation(53, 53), _citation(53, 53)],
        captures=[],
        reasoning_summary="two thoughts on one line",
    )
    assert len(match.citations) == 1
    assert match.citations[0].utterance_start_idx == 53


def test_duplicate_citation_remaps_capture_idx():
    """Captures pointing at a dropped duplicate are remapped to the survivor, so
    both thoughts stay tied to the surviving citation."""
    match = VoiceSuggestionMatch(
        action="create_entities",
        confidence=0.9,
        citations=[_citation(53, 53), _citation(53, 53)],
        captures=[
            MatchCapture(capture_text="first thought", citation_idx=0),
            # Pointed at the duplicate (idx 1); must remap to the survivor (idx 0).
            MatchCapture(capture_text="second thought", citation_idx=1),
        ],
        reasoning_summary="two captures, one line",
    )
    assert len(match.citations) == 1
    assert [c.citation_idx for c in match.captures] == [0, 0]


def test_dedup_preserves_distinct_citations_and_remaps_trailing_idx():
    """Only exact duplicates merge; a later distinct citation keeps its own slot
    and capture indices pointing past the dropped duplicate shift down."""
    match = VoiceSuggestionMatch(
        action="create_entities",
        confidence=0.9,
        # idx 0 and 1 are duplicates of [53,53]; idx 2 is a distinct line.
        citations=[_citation(53, 53), _citation(53, 53), _citation(70, 70)],
        captures=[
            MatchCapture(capture_text="on line 53", citation_idx=0),
            # Tied to the distinct [70,70] citation, which shifts from idx 2 to 1.
            MatchCapture(capture_text="on line 70", citation_idx=2),
        ],
        reasoning_summary="two distinct lines, one duplicated",
    )
    assert [(c.utterance_start_idx, c.utterance_end_idx) for c in match.citations] == [
        (53, 53),
        (70, 70),
    ]
    assert [c.citation_idx for c in match.captures] == [0, 1]


def test_partial_overlap_still_rejected_after_dedup():
    """Dedup only collapses identical ranges; genuine partial overlaps remain a
    real ambiguity and still fail validation."""
    with pytest.raises(ValueError, match="overlap"):
        VoiceSuggestionMatch(
            action="create_entities",
            confidence=0.9,
            citations=[_citation(5, 7), _citation(6, 9)],
            captures=[],
            reasoning_summary="genuine partial overlap",
        )
