from __future__ import annotations

from pathlib import Path
from string import Template
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.providers.llm import create_llm_client
from app.schemas.rag import ModelConfig

DEFAULT_MODEL: Literal["gpt-5.6-luna"] = "gpt-5.6-luna"
# NOTE: the native structured-output path (`client.extract`) calls
# `responses.parse` without forwarding reasoning params, so this effort applies
# only to client construction, not the extraction call itself.
REASONING_EFFORT: Literal["high"] = "high"

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
VOICE_SUGGESTION_SYSTEM_PROMPT = (_PROMPTS_DIR / "voice_suggestion_matcher.md").read_text().strip()
# Use string.Template ($name) so the prompt is safe to interpolate with arbitrary
# user-provided text — { and } in voice transcripts / utterances would otherwise
# crash str.format() at runtime.
VOICE_SUGGESTION_USER_PROMPT_TEMPLATE = Template(
    (_PROMPTS_DIR / "voice_suggestion_matcher_user.md").read_text()
)

VoiceSuggestionAction = Literal["create_entities", "uncertain"]


class MatchCitation(BaseModel):
    utterance_start_idx: int
    utterance_end_idx: int
    citation_text: str
    speaker: str | None = Field(
        default=None,
        description=(
            "Real name of the speaker if identifiable from the transcript or the user's note. "
            "Leave null when only diarization placeholders (e.g. 'A', 'speaker_a') are available."
        ),
    )
    context: str | None = Field(
        default=None,
        description=(
            "Short framing of what's happening around the quote — topic, role of the speaker, "
            "or anything that helps the user recognize the moment later. "
            "Leave null if nothing useful to add."
        ),
    )

    @model_validator(mode="after")
    def validate_indices(self) -> "MatchCitation":
        if self.utterance_end_idx < self.utterance_start_idx:
            raise ValueError("citation utterance range is invalid")
        if not self.citation_text:
            raise ValueError("citation_text must not be empty")
        return self


class MatchCapture(BaseModel):
    capture_text: str
    citation_idx: int | None = Field(
        default=None,
        description=(
            "Index into the citations array this capture is tied to, or null if standalone."
        ),
    )

    @model_validator(mode="after")
    def validate_text(self) -> "MatchCapture":
        if not self.capture_text:
            raise ValueError("capture_text must not be empty")
        if self.citation_idx is not None and self.citation_idx < 0:
            raise ValueError("citation_idx must be >= 0")
        return self


class VoiceSuggestionMatch(BaseModel):
    action: VoiceSuggestionAction
    confidence: float = Field(ge=0, le=1)
    citations: list[MatchCitation] = Field(default_factory=list)
    captures: list[MatchCapture] = Field(default_factory=list)
    reasoning_summary: str

    @model_validator(mode="before")
    @classmethod
    def coalesce_duplicate_citations(cls, data: Any) -> Any:
        """Merge citations that cover the exact same utterance range before validation.

        The matcher LLM reliably (~weekly in prod) emits two identical single-line
        citations — e.g. [53, 53] twice — when a rambling note has two distinct
        thoughts about the same transcript moment. The intended shape is one
        citation with both captures tied to it via ``citation_idx``, which the
        schema already supports, but the model duplicates the citation instead.
        Rather than fail the whole suggestion (forcing a user retry), collapse
        exact-duplicate ranges into the first occurrence and remap any
        ``captures[].citation_idx`` that pointed at a merged duplicate. Genuine
        partial overlaps ([5, 7] vs [6, 9]) are left untouched and still rejected
        downstream, since those signal real ambiguity worth surfacing.
        """
        if not isinstance(data, dict):
            return data
        citations = data.get("citations")
        if not isinstance(citations, list) or len(citations) < 2:
            return data

        # Map each citation's (start, end) range to the index of its first
        # occurrence; build the index remap as we drop later duplicates.
        first_index_for_range: dict[tuple[int, int], int] = {}
        index_remap: dict[int, int] = {}
        deduped: list[Any] = []
        for original_idx, citation in enumerate(citations):
            key = cls._citation_range_key(citation)
            if key is not None and key in first_index_for_range:
                index_remap[original_idx] = first_index_for_range[key]
                continue
            kept_idx = len(deduped)
            index_remap[original_idx] = kept_idx
            if key is not None:
                first_index_for_range[key] = kept_idx
            deduped.append(citation)

        if len(deduped) == len(citations):
            return data

        data["citations"] = deduped
        captures = data.get("captures")
        if isinstance(captures, list):
            for capture in captures:
                if isinstance(capture, dict):
                    idx = capture.get("citation_idx")
                    if isinstance(idx, int) and idx in index_remap:
                        capture["citation_idx"] = index_remap[idx]
                else:
                    # Already-constructed MatchCapture (e.g. callers/tests passing
                    # model instances rather than raw LLM dicts).
                    idx = getattr(capture, "citation_idx", None)
                    if isinstance(idx, int) and idx in index_remap:
                        capture.citation_idx = index_remap[idx]
        return data

    @staticmethod
    def _citation_range_key(citation: Any) -> tuple[int, int] | None:
        """Extract a (start, end) utterance range from raw citation input, or None."""
        if isinstance(citation, dict):
            start = citation.get("utterance_start_idx")
            end = citation.get("utterance_end_idx")
        else:
            start = getattr(citation, "utterance_start_idx", None)
            end = getattr(citation, "utterance_end_idx", None)
        if isinstance(start, int) and isinstance(end, int):
            return (start, end)
        return None

    @model_validator(mode="after")
    def validate_action_payload(self) -> "VoiceSuggestionMatch":
        if self.action == "create_entities":
            if not self.citations and not self.captures:
                raise ValueError("create_entities requires at least one citation or capture")
            for i, cap in enumerate(self.captures):
                if cap.citation_idx is not None and cap.citation_idx >= len(self.citations):
                    raise ValueError(
                        f"captures[{i}].citation_idx={cap.citation_idx} "
                        f"out of range (citations length={len(self.citations)})"
                    )
            self._validate_no_overlapping_citations()
        return self

    def _validate_no_overlapping_citations(self) -> None:
        """Transcript highlights cannot overlap — each utterance span belongs to at
        most one citation. Reject any two citations whose utterance ranges intersect
        so a non-overlap invariant holds before the suggestion reaches the UI/DB.
        """
        # Sort by start index, then a single linear pass: an overlap exists iff a
        # citation starts at or before the previous one's end.
        ordered = sorted(
            self.citations,
            key=lambda c: (c.utterance_start_idx, c.utterance_end_idx),
        )
        for prev, curr in zip(ordered, ordered[1:]):
            if curr.utterance_start_idx <= prev.utterance_end_idx:
                raise ValueError(
                    f"citations overlap: utterance ranges "
                    f"[{prev.utterance_start_idx}, {prev.utterance_end_idx}] and "
                    f"[{curr.utterance_start_idx}, {curr.utterance_end_idx}] intersect. "
                    f"Each transcript span may belong to only one citation."
                )


class VoiceSuggestionMatcher:
    def __init__(self) -> None:
        # Relies on `extract()` (native structured outputs on OpenAI). Raises if
        # the provider has no OpenAI key configured.
        self.client = create_llm_client(
            ModelConfig(
                provider="openai",
                model=DEFAULT_MODEL,
                reasoning_effort=REASONING_EFFORT,
            )
        )

    async def match(
        self,
        *,
        voice_transcript: str,
        playback_position_seconds: float,
        candidate_utterances: list[dict[str, Any]],
        refinement: str | None = None,
    ) -> VoiceSuggestionMatch:
        if not voice_transcript.strip():
            raise ValueError("Voice transcript is empty")
        if not candidate_utterances:
            raise ValueError("No transcript candidates available for matching")

        prompt = self._build_prompt(
            voice_transcript=voice_transcript,
            playback_position_seconds=playback_position_seconds,
            candidate_utterances=candidate_utterances,
            refinement=refinement,
        )

        # Use the provider's native structured-output mode (OpenAI Responses
        # `parse` with a strict JSON schema). Generation is constrained to the
        # schema at decode time, so the model physically cannot answer in prose —
        # unlike the agent/tool-call path, which a reasoning model would
        # intermittently sidestep by narrating JSON instead of calling the tool.
        match = await self.client.extract(
            schema=VoiceSuggestionMatch,
            query=prompt,
            system_prompt=VOICE_SUGGESTION_SYSTEM_PROMPT,
        )
        if not isinstance(match, VoiceSuggestionMatch):
            # `parse` returns None only on an explicit refusal or a truncated /
            # malformed response — rare, but surface it clearly for triage.
            raise ValueError(
                f"Voice match extraction returned no structured result (got {match!r})"
            )
        return match

    def _build_prompt(
        self,
        *,
        voice_transcript: str,
        playback_position_seconds: float,
        candidate_utterances: list[dict[str, Any]],
        refinement: str | None = None,
    ) -> str:
        transcript_lines = "\n".join(
            self._format_candidate_line(candidate) for candidate in candidate_utterances
        )
        prompt = VOICE_SUGGESTION_USER_PROMPT_TEMPLATE.substitute(
            playback_position_seconds=f"{playback_position_seconds:.2f}",
            voice_transcript=voice_transcript,
            transcript_lines=transcript_lines,
        )
        # Steering from a manual retry — appended after substitution so the user's
        # text can't collide with template placeholders.
        if refinement and refinement.strip():
            prompt += (
                "\n\nThe user reviewed a previous extraction and asked you to "
                f"redo it with this guidance:\n{refinement.strip()}"
            )
        return prompt

    def _format_candidate_line(self, candidate: dict[str, Any]) -> str:
        raw_speaker = candidate.get("speaker")
        # Diarization placeholder (e.g. 'A', 'speaker_a') — keep as a turn marker only,
        # never a real name. The prompt instructs the model not to copy this into `speaker`.
        turn = f"turn={raw_speaker} " if raw_speaker else ""
        text = str(candidate.get("text") or "").strip()
        return (
            f"[{candidate['index']}] "
            f"{float(candidate.get('start') or 0):.2f}-{float(candidate.get('end') or 0):.2f}s "
            f"{turn}{text}"
        )
