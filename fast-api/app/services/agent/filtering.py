"""Shared source-type definitions for agent search actions."""

from typing import Literal, TypeAlias, cast

# Canonical source types accepted by search tools.
SourceType: TypeAlias = Literal["book", "article", "podcast", "video", "pdf"]

# TODO: If we see frequent tool-call validation errors caused by minor formatting
# differences (e.g. "podcasts" vs "podcast"), add a minimal alias normalizer here.


def to_source_type_filter(source_types: list[SourceType] | None) -> list[str] | None:
    """Convert strict SourceType values to search-layer string filters."""
    if source_types is None:
        return None
    return cast(list[str], list(source_types))
