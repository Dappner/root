"""Backend-owned catalog of LLMs exposed to application clients."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

ModelProvider = Literal["gemini", "openai", "anthropic"]
ModelTier = Literal["fast", "balanced", "powerful"]
ReasoningParameter = Literal["thinking_level", "reasoning_effort"]
ReasoningLevel = Literal["none", "minimal", "low", "medium", "high", "xhigh", "max"]


class ReasoningOption(BaseModel):
    model_config = ConfigDict(frozen=True)

    value: ReasoningLevel
    label: str
    description: str


class ModelReasoningConfig(BaseModel):
    model_config = ConfigDict(frozen=True)

    parameter: ReasoningParameter
    default: ReasoningLevel
    options: tuple[ReasoningOption, ...]


class CatalogModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    label: str
    description: str
    provider: ModelProvider
    tier: ModelTier
    recommended: bool = False
    reasoning: ModelReasoningConfig | None = None


class ModelCatalog(BaseModel):
    model_config = ConfigDict(frozen=True)

    version: str
    default_model: str
    models: tuple[CatalogModel, ...]


def _options(*values: ReasoningLevel) -> tuple[ReasoningOption, ...]:
    descriptions = {
        "none": ("None", "Fastest response with reasoning disabled"),
        "minimal": ("Minimal", "Lowest latency for simple questions"),
        "low": ("Low", "Light reasoning with lower latency"),
        "medium": ("Medium", "Balanced quality, latency, and cost"),
        "high": ("High", "Deeper reasoning for difficult questions"),
        "xhigh": ("Extra high", "Extended reasoning for demanding work"),
        "max": ("Maximum", "Highest capability; slowest and most expensive"),
    }
    return tuple(
        ReasoningOption(
            value=value,
            label=descriptions[value][0],
            description=descriptions[value][1],
        )
        for value in values
    )


GEMINI_ALL_LEVELS = _options("minimal", "low", "medium", "high")
GEMINI_PRO_LEVELS = _options("low", "medium", "high")
OPENAI_LEVELS = _options("none", "low", "medium", "high", "xhigh", "max")
CLAUDE_5_LEVELS = _options("low", "medium", "high", "xhigh", "max")
CLAUDE_HAIKU_LEVELS = _options("none", "low", "medium", "high")


MODEL_CATALOG = ModelCatalog(
    version="2026-08-17.1",
    default_model="gemini-3.6-flash",
    models=(
        CatalogModel(
            id="gemini-3.5-flash-lite",
            label="Gemini 3.5 Flash-Lite",
            description="Lowest-cost Gemini for quick lookups",
            provider="gemini",
            tier="fast",
            reasoning=ModelReasoningConfig(
                parameter="thinking_level",
                default="minimal",
                options=GEMINI_ALL_LEVELS,
            ),
        ),
        CatalogModel(
            id="gemini-3.6-flash",
            label="Gemini 3.6 Flash",
            description="Fast, capable, and multimodal",
            provider="gemini",
            tier="balanced",
            recommended=True,
            reasoning=ModelReasoningConfig(
                parameter="thinking_level",
                default="medium",
                options=GEMINI_ALL_LEVELS,
            ),
        ),
        CatalogModel(
            id="gemini-3.1-pro-preview",
            label="Gemini 3.1 Pro",
            description="Google's deepest reasoning model",
            provider="gemini",
            tier="powerful",
            reasoning=ModelReasoningConfig(
                parameter="thinking_level",
                default="high",
                options=GEMINI_PRO_LEVELS,
            ),
        ),
        CatalogModel(
            id="gpt-5.6-luna",
            label="GPT-5.6 Luna",
            description="Efficient OpenAI model for everyday work",
            provider="openai",
            tier="fast",
            reasoning=ModelReasoningConfig(
                parameter="reasoning_effort",
                default="low",
                options=OPENAI_LEVELS,
            ),
        ),
        CatalogModel(
            id="gpt-5.6-terra",
            label="GPT-5.6 Terra",
            description="Balanced intelligence, speed, and cost",
            provider="openai",
            tier="balanced",
            recommended=True,
            reasoning=ModelReasoningConfig(
                parameter="reasoning_effort",
                default="medium",
                options=OPENAI_LEVELS,
            ),
        ),
        CatalogModel(
            id="gpt-5.6-sol",
            label="GPT-5.6 Sol",
            description="OpenAI's frontier model for complex work",
            provider="openai",
            tier="powerful",
            reasoning=ModelReasoningConfig(
                parameter="reasoning_effort",
                default="high",
                options=OPENAI_LEVELS,
            ),
        ),
        CatalogModel(
            id="claude-haiku-4-5",
            label="Claude Haiku 4.5",
            description="Fastest Claude for concise questions",
            provider="anthropic",
            tier="fast",
            reasoning=ModelReasoningConfig(
                parameter="reasoning_effort",
                default="low",
                options=CLAUDE_HAIKU_LEVELS,
            ),
        ),
        CatalogModel(
            id="claude-sonnet-5",
            label="Claude Sonnet 5",
            description="Strong balance for research and synthesis",
            provider="anthropic",
            tier="balanced",
            recommended=True,
            reasoning=ModelReasoningConfig(
                parameter="reasoning_effort",
                default="medium",
                options=CLAUDE_5_LEVELS,
            ),
        ),
        CatalogModel(
            id="claude-opus-5",
            label="Claude Opus 5",
            description="Anthropic's highest-capability model",
            provider="anthropic",
            tier="powerful",
            reasoning=ModelReasoningConfig(
                parameter="reasoning_effort",
                default="high",
                options=CLAUDE_5_LEVELS,
            ),
        ),
    ),
)

MODEL_BY_ID = {model.id: model for model in MODEL_CATALOG.models}
DEFAULT_MODEL_ID = MODEL_CATALOG.default_model
