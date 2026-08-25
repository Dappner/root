"""Content hashing helpers used for embedding staleness detection.

The hex digest is what we persist in `content_sha256` columns; staying in one
place keeps the encoding (UTF-8) and digest format (hex) consistent across
services that compare hashes during embedding regeneration.
"""

from __future__ import annotations

import hashlib
from typing import Any


def sha256_hex(value: str) -> str:
    """Return the SHA-256 hex digest of ``value`` encoded as UTF-8."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_hex_or_none(value: Any) -> str | None:
    """Hash ``value`` after coercion to str + strip; return None if the result is empty.

    Mirrors the legacy `_sha256` / `_sha256_text` helpers in citation/suggestion services:
    callers persist None to mean "no canonical content to hash yet."
    """
    text = str(value or "").strip()
    if not text:
        return None
    return sha256_hex(text)
