"""Unit tests for the section summary hash.

The digest is defined as:
  - text = " - ".join([title, subtitle?, summary]) (subtitle only if non-empty)
  - digest = hex(sha256(utf8(text)))

The expected hex values below are derived purely from that algorithm, so a
regression in either the text builder or the hashing fails here without a live
DB row.
"""

from __future__ import annotations

import hashlib

from app.services.source_section_service import (
    _section_summary_hash,
    build_section_embedding_text,
)


def _expected_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_embedding_text_joins_with_dash_and_includes_subtitle() -> None:
    assert (
        build_section_embedding_text("Chapter 1", "The Beginning", "It starts here.")
        == "Chapter 1 - The Beginning - It starts here."
    )


def test_embedding_text_omits_none_subtitle() -> None:
    assert build_section_embedding_text("Chapter 1", None, "Body") == "Chapter 1 - Body"


def test_embedding_text_omits_empty_subtitle() -> None:
    assert build_section_embedding_text("Chapter 1", "", "Body") == "Chapter 1 - Body"


def test_hash_matches_algorithm_with_subtitle() -> None:
    title, subtitle, summary = "Chapter 1", "The Beginning", "It starts here."
    # Literal hex digest of "Chapter 1 - The Beginning - It starts here." — a
    # silent change to the join/encoding is caught even without a live DB row.
    expected = "195de6f5a618d816ce6b148984efb3218d2a9d77ffe2899c30b66b8b7b99a629"
    assert _expected_hash("Chapter 1 - The Beginning - It starts here.") == expected
    assert _section_summary_hash(title, subtitle, summary) == expected


def test_hash_matches_algorithm_without_subtitle() -> None:
    expected = _expected_hash("Title - Summary body")
    assert _section_summary_hash("Title", None, "Summary body") == expected


def test_hash_matches_algorithm_unicode() -> None:
    # UTF-8 encoding parity for non-ASCII text.
    title, subtitle, summary = "Café", "naïve—dash", "résumé ✓"
    expected = _expected_hash("Café - naïve—dash - résumé ✓")
    assert _section_summary_hash(title, subtitle, summary) == expected
