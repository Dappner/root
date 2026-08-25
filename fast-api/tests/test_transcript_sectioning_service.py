from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.transcript_sectioning_service import (
    AutoSection,
    TranscriptSectioningService,
    _build_prompt,
    _compute_duration,
    _format_line,
    _validate_sections,
)


def _make_utterances(count: int, seconds_each: float = 60.0) -> list[dict]:
    return [
        {
            "text": f"utterance {i}",
            "start": i * seconds_each,
            "end": (i + 1) * seconds_each,
            "confidence": 0.95,
            "speaker": "A" if i % 2 == 0 else "B",
        }
        for i in range(count)
    ]


class TestFormatLine:
    def test_with_speaker(self):
        u = {"text": "hello world", "start": 12.7, "speaker": "A"}
        assert _format_line(u) == "[12s] A: hello world"

    def test_youtube_no_speaker(self):
        u = {"text": "hello world", "start": 12.7, "speaker": None}
        assert _format_line(u) == "[12s] hello world"

    def test_strips_whitespace(self):
        u = {"text": "  spaced  ", "start": 0, "speaker": "A"}
        assert _format_line(u) == "[0s] A: spaced"


class TestComputeDuration:
    def test_returns_max_end(self):
        utterances = _make_utterances(3, seconds_each=30)
        assert _compute_duration(utterances) == 90.0

    def test_empty(self):
        assert _compute_duration([]) == 0.0


class TestBuildPrompt:
    def test_includes_duration_and_count(self):
        utterances = _make_utterances(2, seconds_each=30)
        prompt = _build_prompt(utterances, duration=60.0)
        assert "60 seconds" in prompt
        assert "Utterance count: 2" in prompt
        assert "[0s] A:" in prompt
        assert "[30s] B:" in prompt


class TestValidateSections:
    def _make(self, *ranges_with_titles) -> list[AutoSection]:
        return [AutoSection(start_sec=s, end_sec=e, title=t) for s, e, t in ranges_with_titles]

    def test_happy_path_contiguous(self):
        sections = self._make(
            (0, 300, "Intro"),
            (300, 600, "Middle"),
            (600, 900, "Outro"),
        )
        result = _validate_sections(sections, total_duration=900.0)
        assert result is not None
        assert len(result) == 3

    def test_rejects_too_few(self):
        sections = self._make((0, 500, "A"), (500, 900, "B"))
        assert _validate_sections(sections, total_duration=900.0) is None

    def test_rejects_too_many(self):
        sections = self._make(*[(i * 100, (i + 1) * 100, f"S{i}") for i in range(21)])
        assert _validate_sections(sections, total_duration=2100.0) is None

    def test_rejects_gaps(self):
        # 50s gap between 300 and 350 — beyond the small-gap repair tolerance.
        sections = self._make(
            (0, 300, "A"),
            (350, 600, "B"),
            (600, 900, "C"),
        )
        assert _validate_sections(sections, total_duration=900.0) is None

    def test_repairs_small_gaps(self):
        # Gemini commonly returns inclusive end_sec with next start_sec = end+1.
        # The validator should snap these together rather than rejecting.
        sections = self._make(
            (0, 300, "A"),
            (301, 600, "B"),
            (601, 900, "C"),
        )
        result = _validate_sections(sections, total_duration=900.0)
        assert result is not None
        assert [(s.start_sec, s.end_sec) for s in result] == [(0, 300), (300, 600), (600, 900)]

    def test_rejects_overlaps(self):
        sections = self._make(
            (0, 350, "A"),
            (300, 600, "B"),
            (600, 900, "C"),
        )
        assert _validate_sections(sections, total_duration=900.0) is None

    def test_snaps_first_section_to_zero(self):
        # First section starts at 5s instead of 0 — leniency snaps it.
        sections = self._make(
            (5, 300, "A"),
            (300, 600, "B"),
            (600, 900, "C"),
        )
        result = _validate_sections(sections, total_duration=900.0)
        assert result is not None
        assert result[0].start_sec == 0

    def test_rejects_short_tail(self):
        # Last section ends way before total duration.
        sections = self._make(
            (0, 200, "A"),
            (200, 400, "B"),
            (400, 600, "C"),
        )
        assert _validate_sections(sections, total_duration=900.0) is None

    def test_allows_30s_tail_slack(self):
        # Last section within 30s of end — accepted.
        sections = self._make(
            (0, 300, "A"),
            (300, 600, "B"),
            (600, 875, "C"),
        )
        result = _validate_sections(sections, total_duration=900.0)
        assert result is not None


class TestGenerateSkips:
    @pytest.mark.asyncio
    async def test_skips_without_api_key(self):
        service = TranscriptSectioningService(session_factory=MagicMock(), llm_api_key=None)
        service._call_llm = AsyncMock()  # type: ignore[method-assign]
        await service.generate(source_ids=[1], utterances=_make_utterances(20))
        service._call_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_empty_utterances(self):
        service = TranscriptSectioningService(session_factory=MagicMock(), llm_api_key="key")
        service._call_llm = AsyncMock()  # type: ignore[method-assign]
        await service.generate(source_ids=[1], utterances=[])
        service._call_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_short_transcripts(self):
        service = TranscriptSectioningService(session_factory=MagicMock(), llm_api_key="key")
        service._call_llm = AsyncMock()  # type: ignore[method-assign]
        # 9 minutes of content — below 600s threshold.
        await service.generate(source_ids=[1], utterances=_make_utterances(9, seconds_each=60))
        service._call_llm.assert_not_called()

    @pytest.mark.asyncio
    async def test_swallows_llm_failure(self):
        service = TranscriptSectioningService(session_factory=MagicMock(), llm_api_key="key")
        service._call_llm = AsyncMock(side_effect=RuntimeError("provider down"))  # type: ignore[method-assign]
        service._persist = AsyncMock()  # type: ignore[method-assign]
        # 11 minutes of content — past threshold, will attempt LLM call.
        await service.generate(source_ids=[1], utterances=_make_utterances(11, seconds_each=60))
        service._persist.assert_not_called()  # validation/persist skipped after failure

    @pytest.mark.asyncio
    async def test_no_op_when_no_sources(self):
        service = TranscriptSectioningService(session_factory=MagicMock(), llm_api_key="key")
        service._call_llm = AsyncMock()  # type: ignore[method-assign]
        await service.generate(source_ids=[], utterances=_make_utterances(20))
        service._call_llm.assert_not_called()


class TestGenerateFanOut:
    @pytest.mark.asyncio
    async def test_fans_out_to_all_sources_with_one_llm_call(self):
        """LLM runs once, persist runs per source. Both must succeed for every source."""
        from app.services.transcript_sectioning_service import AutoSection

        service = TranscriptSectioningService(session_factory=MagicMock(), llm_api_key="key")
        valid_sections = [
            AutoSection(start_sec=0, end_sec=220, title="Intro"),
            AutoSection(start_sec=220, end_sec=440, title="Middle"),
            AutoSection(start_sec=440, end_sec=660, title="Outro"),
        ]
        service._call_llm = AsyncMock(return_value=valid_sections)  # type: ignore[method-assign]
        service._persist = AsyncMock()  # type: ignore[method-assign]

        await service.generate(
            source_ids=[10, 20, 30],
            utterances=_make_utterances(11, seconds_each=60),
        )

        service._call_llm.assert_called_once()
        assert service._persist.await_count == 3
        persisted_source_ids = [call.args[0] for call in service._persist.await_args_list]
        assert persisted_source_ids == [10, 20, 30]

    @pytest.mark.asyncio
    async def test_persist_failure_on_one_source_does_not_block_others(self):
        from app.services.transcript_sectioning_service import AutoSection

        service = TranscriptSectioningService(session_factory=MagicMock(), llm_api_key="key")
        valid_sections = [
            AutoSection(start_sec=0, end_sec=220, title="A"),
            AutoSection(start_sec=220, end_sec=440, title="B"),
            AutoSection(start_sec=440, end_sec=660, title="C"),
        ]
        service._call_llm = AsyncMock(return_value=valid_sections)  # type: ignore[method-assign]

        async def persist_with_one_failure(source_id, _sections):
            if source_id == 20:
                raise RuntimeError("DB hiccup")

        service._persist = AsyncMock(side_effect=persist_with_one_failure)  # type: ignore[method-assign]

        await service.generate(
            source_ids=[10, 20, 30],
            utterances=_make_utterances(11, seconds_each=60),
        )

        assert service._persist.await_count == 3
