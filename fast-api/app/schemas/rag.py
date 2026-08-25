from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.core.datetime_utils import UTCDatetime
from app.schemas.model_catalog import MODEL_BY_ID, ModelProvider

HitKind = Literal["citation", "capture", "takeaway", "source_section_summary", "transcript_chunk"]

QUESTION_MAX_LENGTH = 4000
ThinkingLevel = Literal["minimal", "low", "medium", "high"]
ReasoningEffort = Literal["none", "low", "medium", "high", "xhigh", "max"]


class RetrievalFilters(BaseModel):
    source_ids: list[int] | None = None
    source_types: list[str] | None = None


class ModelConfig(BaseModel):
    provider: ModelProvider = "gemini"
    model: str = "gemini-3.6-flash"
    thinking_level: ThinkingLevel | None = None
    reasoning_effort: ReasoningEffort | None = None

    @model_validator(mode="after")
    def validate_provider_model_and_reasoning(self) -> "ModelConfig":
        catalog_model = MODEL_BY_ID.get(self.model)
        if catalog_model is None:
            raise ValueError(f"Model '{self.model}' is not available")
        if catalog_model.provider != self.provider:
            raise ValueError(f"Model '{self.model}' is not valid for provider '{self.provider}'")

        supplied = {
            "thinking_level": self.thinking_level,
            "reasoning_effort": self.reasoning_effort,
        }
        reasoning = catalog_model.reasoning
        for parameter, value in supplied.items():
            if value is None:
                continue
            if reasoning is None or parameter != reasoning.parameter:
                raise ValueError(f"{parameter} is not supported for model '{self.model}'")
            allowed = {option.value for option in reasoning.options}
            if value not in allowed:
                allowed_display = ", ".join(option.value for option in reasoning.options)
                raise ValueError(
                    f"{parameter} '{value}' is not supported for model '{self.model}'. "
                    f"Allowed: {allowed_display}"
                )

        return self


class AskContext(BaseModel):
    surface: Literal[
        "ask",
        "library",
        "source",
        "section",
        "citation",
        "note",
        "takeaways",
        "review",
    ]
    source_id: int | None = None
    section_id: int | None = None
    citation_id: int | None = None
    note_id: int | None = None
    takeaway_id: int | None = None


class AskHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=QUESTION_MAX_LENGTH)
    filters: RetrievalFilters | None = None
    model_config_: ModelConfig | None = Field(None, alias="model_config")
    context: AskContext | None = None
    history: list[AskHistoryMessage] = Field(default_factory=list, max_length=12)
    request_id: str | None = Field(
        default=None,
        min_length=8,
        max_length=64,
        description=(
            "Client-generated idempotency / resume key. If a run with this id is already "
            "in progress or recently completed, the server re-attaches and streams its "
            "buffered events instead of starting a new LLM call."
        ),
    )


class ReflectRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=QUESTION_MAX_LENGTH)
    model_config_: ModelConfig | None = Field(None, alias="model_config")


class RetrievalHit(BaseModel):
    kind: HitKind
    entity_id: int
    text: str
    source_id: int | None = None
    source_title: str | None = None
    source_type: str | None = None
    source_author: str | None = None
    source_label: str | None = None
    source_status: str | None = None
    source_published_at: UTCDatetime | None = None
    source_last_active_at: UTCDatetime | None = None
    section_id: int | None = None
    citation_id: int | None = None
    citation_text: str | None = None
    citation_speaker: str | None = None
    citation_context: str | None = None
    takeaway_title: str | None = None
    takeaway_body: str | None = None
    section_title: str | None = None
    section_subtitle: str | None = None
    section_summary: str | None = None
    chunk_index: int | None = None
    chunk_start: float | None = None
    chunk_end: float | None = None
    chunk_speakers: list[str] | None = None
    score: float
    vec_rank: int | None = None
    fts_rank: int | None = None


class RagReference(BaseModel):
    ref_key: str
    kind: HitKind
    entity_id: int
    text: str | None = None
    source_id: int | None = None
    source_title: str | None = None
    source_type: str | None = None
    source_author: str | None = None
    source_label: str | None = None
    source_status: str | None = None
    source_published_at: UTCDatetime | None = None
    source_last_active_at: UTCDatetime | None = None
    section_id: int | None = None
    section_title: str | None = None
    section_subtitle: str | None = None
    takeaway_title: str | None = None
    takeaway_body: str | None = None
    score: float | None = None


class AskResponse(BaseModel):
    answer: str
    hits: list[RetrievalHit]
    refs: dict[str, RagReference] | None = None
    used_ref_keys: list[str] | None = None


class StreamDeltaPayload(BaseModel):
    text: str
    citations: dict[str, RagReference] | None = None
    ref_keys: list[str] | None = None
    refs: dict[str, RagReference] | None = None


class StreamDonePayload(BaseModel):
    refs: dict[str, RagReference] | None = None
    used_ref_keys: list[str] | None = None


class StreamHitsPayload(BaseModel):
    hits: list[RetrievalHit]


class StreamErrorPayload(BaseModel):
    message: str
