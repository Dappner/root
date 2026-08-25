from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic import ValidationError as PydanticValidationError

from app.core.datetime_utils import UTCDatetime
from app.core.exceptions import ValidationError as AppValidationError


class _MetadataBase(BaseModel):
    # Accept unknown keys without rejecting — legacy rows may carry extras we
    # haven't migrated yet, and we'd rather pass them through than 500.
    model_config = ConfigDict(extra="allow")


class BookMetadata(_MetadataBase):
    type: Literal["book"] = "book"
    author: str | None = None
    isbn: str | None = None
    pages: int | None = None
    current_page: int | None = None
    fingerprint: str | None = None


class VideoMetadata(_MetadataBase):
    type: Literal["video"] = "video"
    url: str | None = None
    channel: str | None = None
    duration: int | None = None  # seconds
    current_position: int | None = None  # seconds
    last_watched_at: UTCDatetime | None = None
    completed: bool | None = None


class ArticleMetadata(_MetadataBase):
    type: Literal["article"] = "article"
    url: str | None = None
    publication: str | None = None
    published_at: str | None = None  # ISO date string
    scroll_percent: float | None = None


class PdfMetadata(_MetadataBase):
    type: Literal["pdf"] = "pdf"
    page_count: int | None = None
    current_page: int | None = None
    has_text_layer: bool | None = None
    size_bytes: int | None = None


class PodcastMetadata(_MetadataBase):
    type: Literal["podcast"] = "podcast"
    url: str | None = None
    episode: str | None = None
    duration: int | None = None  # seconds
    current_position: int | None = None  # seconds
    last_listened_at: UTCDatetime | None = None
    completed: bool | None = None


SourceMetadata = Annotated[
    BookMetadata | VideoMetadata | ArticleMetadata | PdfMetadata | PodcastMetadata,
    Field(discriminator="type"),
]


def parse_source_metadata(raw: dict[str, Any] | None, source_type: str) -> SourceMetadata | None:
    if not raw:
        return None
    # sources.type is authoritative — discard any stray discriminator on the blob
    # so a legacy row with metadata={"type":"book",...} on a video source can't
    # mis-route to BookMetadata.
    data = {**raw, "type": source_type}
    try:
        from pydantic import TypeAdapter

        return TypeAdapter(SourceMetadata).validate_python(data)
    except Exception:
        return None


_KNOWN_SOURCE_TYPES = frozenset({"book", "video", "article", "pdf", "podcast"})


def validate_source_metadata(raw: dict[str, Any] | None, source_type: str) -> None:
    """Raising structural validation of source metadata for a given type.

    Empty metadata is valid, unknown source types pass through untouched, and
    known types are validated against the discriminated `SourceMetadata` union.
    The blob's `type` is forced to the authoritative `source_type` so a stray
    discriminator can't mis-route.

    Raises `ValidationError` (-> HTTP 400) on a structurally invalid blob.
    """
    if not raw:
        return
    if source_type not in _KNOWN_SOURCE_TYPES:
        return
    data = {**raw, "type": source_type}
    try:
        from pydantic import TypeAdapter

        TypeAdapter(SourceMetadata).validate_python(data)
    except PydanticValidationError as exc:
        raise AppValidationError(f"invalid {source_type} metadata: {exc}") from exc
