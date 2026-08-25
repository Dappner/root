from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.datetime_utils import UTCDatetime

SuggestionStatus = Literal["uploaded", "processing", "ready", "failed", "approved", "dismissed"]

# Only `create_entities` and `uncertain` are produced today. Legacy rows still
# carrying create_citation / create_capture / create_citation_with_capture are
# normalized to `create_entities` by the before-validators on SuggestionResponse
# and MatchMetadata before this type narrows them.
SuggestionAction = Literal["create_entities", "uncertain"]


# ── Location payloads ─────────────────────────────────────────────────────────


class TranscriptV1Location(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    utterance_start_idx: int = Field(alias="utteranceStartIdx")
    utterance_end_idx: int = Field(alias="utteranceEndIdx")
    char_offset_start: int = Field(alias="charOffsetStart")
    char_offset_end: int = Field(alias="charOffsetEnd")
    t_start_sec: float = Field(alias="tStartSec")
    t_end_sec: float = Field(alias="tEndSec")


class TranscriptLocation(BaseModel):
    mode: Literal["derived"]
    type: Literal["transcript_v1"]
    transcript: TranscriptV1Location


# ── Nested citation / capture payloads ────────────────────────────────────────


class SuggestedCitationPayload(BaseModel):
    """A single suggested citation."""

    text: str
    info_type: str
    location: TranscriptLocation
    speaker: str | None = None
    context: str | None = None
    section_id: int | None = None
    summary: str | None = None


class SuggestedCapturePayload(BaseModel):
    """A single suggested capture.

    Each capture is attached to at most one citation. The link is expressed via
    `citation_idx` (index into the suggestion's `citations` array) for citations
    that are being created alongside this capture, or `citation_id` for captures
    that should attach to a pre-existing citation. Both null means a standalone
    capture.
    """

    text: str
    citation_idx: int | None = None
    citation_id: int | None = None
    section_id: int | None = None
    summary: str | None = None

    @model_validator(mode="after")
    def validate_citation_link(self) -> "SuggestedCapturePayload":
        if self.citation_idx is not None and self.citation_id is not None:
            raise ValueError("capture cannot set both citation_idx and citation_id")
        if self.citation_idx is not None and self.citation_idx < 0:
            raise ValueError("citation_idx must be >= 0")
        return self


# ── Suggested payload (discriminated by action) ───────────────────────────────


class SuggestedPayloadBase(BaseModel):
    """Fields always present in every suggested_payload."""

    action: SuggestionAction
    confidence: float
    voice_transcript: str
    reasoning_summary: str


class SuggestedPayloadEntities(SuggestedPayloadBase):
    """A suggestion that creates one or more citations and/or captures.

    Captures may reference a citation in this payload by index (`citation_idx`)
    or an existing citation by id (`citation_id`).
    """

    action: Literal["create_entities"]
    citations: list[SuggestedCitationPayload]
    captures: list[SuggestedCapturePayload]

    @model_validator(mode="after")
    def validate_non_empty(self) -> "SuggestedPayloadEntities":
        if not self.citations and not self.captures:
            raise ValueError("create_entities requires at least one citation or capture")
        for i, cap in enumerate(self.captures):
            if cap.citation_idx is not None and cap.citation_idx >= len(self.citations):
                raise ValueError(
                    f"captures[{i}].citation_idx={cap.citation_idx} "
                    f"out of range (citations length={len(self.citations)})"
                )
        return self


class SuggestedPayloadUncertain(SuggestedPayloadBase):
    action: Literal["uncertain"]


SuggestedPayload = SuggestedPayloadEntities | SuggestedPayloadUncertain


def coerce_legacy_suggested_payload(data: object) -> object:
    """Convert a legacy suggested_payload dict into the create_entities shape.

    Rows written before the multi-entity payload landed used these actions:

      - create_citation: { action, citation: {...} }
      - create_capture:  { action, capture:  {..., attach_to_suggested_citation, citation_id} }
      - create_citation_with_capture: { action, citation: {...}, capture: {...} }

    For non-dict inputs, already-new payloads, and `uncertain`, returns input
    unchanged. Always preserves base fields (confidence, voice_transcript,
    reasoning_summary). Unknown actions are returned as-is and will fail open
    on the union validation, which is the same behavior as before.
    """
    if not isinstance(data, dict):
        return data
    action = data.get("action")
    if action not in ("create_citation", "create_capture", "create_citation_with_capture"):
        return data

    base = {
        "action": "create_entities",
        "confidence": data.get("confidence", 0.0),
        "voice_transcript": data.get("voice_transcript", ""),
        "reasoning_summary": data.get("reasoning_summary", ""),
    }
    citations: list[dict[str, object]] = []
    captures: list[dict[str, object]] = []

    raw_citation = data.get("citation")
    if action in ("create_citation", "create_citation_with_capture") and isinstance(
        raw_citation, dict
    ):
        citations.append(dict(raw_citation))

    raw_capture = data.get("capture")
    if action in ("create_capture", "create_citation_with_capture") and isinstance(
        raw_capture, dict
    ):
        cap = dict(raw_capture)
        attach = cap.pop("attach_to_suggested_citation", None)
        # Old shape: attach==True meant "tie to the citation in this same payload"
        # (always idx 0 for create_citation_with_capture). attach==False meant
        # either standalone or tied to an existing citation by citation_id.
        if attach and action == "create_citation_with_capture":
            cap["citation_idx"] = 0
        else:
            cap.setdefault("citation_id", cap.get("citation_id"))
        captures.append(cap)

    return {**base, "citations": citations, "captures": captures}


# ── Processing metadata ───────────────────────────────────────────────────────


class TranscriptionMetadata(BaseModel):
    """Audio transcription result stored in processing_metadata."""

    transcript: str
    provider: str
    confidence: float | None = None
    duration_seconds: float | None = None


class CandidateUtterancePreview(BaseModel):
    index: int
    start: float
    end: float
    speaker: str | None = None
    preview: str


class CandidateContextMetadata(BaseModel):
    playback_position_seconds: float
    utterance_count: int
    utterances: list[CandidateUtterancePreview]


class ApprovalMetadata(BaseModel):
    citation_ids: list[int]
    capture_ids: list[int]
    approved_at: str

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_approval(cls, data: object) -> object:
        # Pre-array rows stored singular citation_id / capture_id ints alongside
        # approved_at. Promote them into the list shape so old approvals deserialize.
        if not isinstance(data, dict):
            return data
        if "citation_ids" in data or "capture_ids" in data:
            return data
        out = dict(data)
        citation_id = out.pop("citation_id", None)
        capture_id = out.pop("capture_id", None)
        out["citation_ids"] = [citation_id] if isinstance(citation_id, int) else []
        out["capture_ids"] = [capture_id] if isinstance(capture_id, int) else []
        return out


class MatchCitationMetadata(BaseModel):
    utterance_start_idx: int
    utterance_end_idx: int
    citation_text: str
    speaker: str | None = None
    context: str | None = None


class MatchCaptureMetadata(BaseModel):
    capture_text: str
    citation_idx: int | None = None


class MatchMetadata(BaseModel):
    """VoiceSuggestionMatch dump stored in processing_metadata."""

    action: SuggestionAction
    confidence: float
    citations: list[MatchCitationMetadata]
    captures: list[MatchCaptureMetadata]
    reasoning_summary: str

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_match(cls, data: object) -> object:
        """Convert legacy match dumps (singular fields, old action names) into the
        array shape so rows written before the multi-entity payload landed
        continue to deserialize.
        """
        if not isinstance(data, dict):
            return data
        if "citations" in data or "captures" in data:
            return data

        out = dict(data)
        action = out.get("action")
        citations: list[dict[str, object]] = []
        captures: list[dict[str, object]] = []

        if action in ("create_citation", "create_citation_with_capture"):
            citation = {
                "utterance_start_idx": out.get("utterance_start_idx"),
                "utterance_end_idx": out.get("utterance_end_idx"),
                "citation_text": out.get("citation_text"),
                "speaker": out.get("speaker"),
                "context": out.get("context"),
            }
            if (
                citation["utterance_start_idx"] is not None
                and citation["utterance_end_idx"] is not None
                and citation["citation_text"]
            ):
                citations.append(citation)
        if action in ("create_capture", "create_citation_with_capture"):
            capture_text = out.get("capture_text")
            if capture_text:
                captures.append(
                    {
                        "capture_text": capture_text,
                        "citation_idx": 0 if action == "create_citation_with_capture" else None,
                    }
                )

        out["citations"] = citations
        out["captures"] = captures
        if action in (
            "create_citation",
            "create_capture",
            "create_citation_with_capture",
        ):
            out["action"] = "create_entities"
        # Drop legacy singular fields so they don't leak through model_dump.
        for key in (
            "utterance_start_idx",
            "utterance_end_idx",
            "citation_text",
            "speaker",
            "context",
            "capture_text",
        ):
            out.pop(key, None)
        return out


class ProcessingMetadata(BaseModel):
    """Structured processing metadata attached to every suggestion.

    All fields are optional — they are added incrementally as processing
    progresses, and earlier stages may not have populated later fields.
    """

    transcription: TranscriptionMetadata | None = None
    candidate_context: CandidateContextMetadata | None = None
    match: MatchMetadata | None = None
    approval: ApprovalMetadata | None = None


# ── Top-level response / request models ──────────────────────────────────────


class SuggestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: str | None = None
    user_id: str
    source_id: int
    episode_id: int | None = None
    origin: Literal["mobile_voice"]
    status: SuggestionStatus
    suggested_action: SuggestionAction | None = None
    playback_position_seconds: Decimal | None = None
    recorded_at: UTCDatetime | None = None
    audio_r2_key: str | None = None
    voice_transcript: str | None = None
    suggested_payload: SuggestedPayload | None = None
    processing_metadata: ProcessingMetadata
    error: str | None = None
    created_at: UTCDatetime
    updated_at: UTCDatetime
    reviewed_at: UTCDatetime | None = None

    @model_validator(mode="before")
    @classmethod
    def coerce_processing_metadata(cls, data: object) -> object:
        if isinstance(data, dict) and isinstance(data.get("processing_metadata"), dict):
            data = dict(data)
            data["processing_metadata"] = ProcessingMetadata.model_validate(
                data["processing_metadata"]
            )
        return data

    @field_validator("suggested_payload", mode="before")
    @classmethod
    def _coerce_legacy_payload(cls, value: object) -> object:
        if isinstance(value, dict):
            return coerce_legacy_suggested_payload(value)
        return value

    @field_validator("suggested_action", mode="before")
    @classmethod
    def _coerce_legacy_action(cls, value: object) -> object:
        # Pre-array rows used three distinct actions which all collapse into
        # create_entities under the new shape.
        if value in (
            "create_citation",
            "create_capture",
            "create_citation_with_capture",
        ):
            return "create_entities"
        return value


class SuggestionListResponse(BaseModel):
    suggestions: list[SuggestionResponse]


class RetrySuggestionRequest(BaseModel):
    """Optional steering for a manual retry — guidance fed into the matcher prompt."""

    refinement: str | None = None


class ApproveSuggestionRequest(BaseModel):
    payload: SuggestedPayload | None = None


class ApproveSuggestionResponse(BaseModel):
    suggestion: SuggestionResponse
    citation_ids: list[int] = Field(default_factory=list)
    capture_ids: list[int] = Field(default_factory=list)
