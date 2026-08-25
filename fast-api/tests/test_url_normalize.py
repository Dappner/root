"""Unit tests for URL normalization (no DB)."""

from __future__ import annotations

import pytest

from app.core.exceptions import ValidationError
from app.core.url import normalize_url


def test_strips_query_and_fragment() -> None:
    assert normalize_url("https://example.com/a?utm=x#frag") == "https://example.com/a"


def test_lowercases_host() -> None:
    assert normalize_url("https://Example.COM/Path") == "https://example.com/Path"


def test_drops_default_https_port() -> None:
    assert normalize_url("https://example.com:443/a") == "https://example.com/a"


def test_drops_default_http_port() -> None:
    assert normalize_url("http://example.com:80/a") == "http://example.com/a"


def test_keeps_non_default_port() -> None:
    assert normalize_url("https://example.com:8443/a") == "https://example.com:8443/a"


def test_trims_trailing_slash() -> None:
    assert normalize_url("https://example.com/a/") == "https://example.com/a"


def test_empty_path_becomes_root() -> None:
    assert normalize_url("https://example.com") == "https://example.com/"


def test_combined_normalization() -> None:
    assert normalize_url("https://Example.com/a/?utm=x#frag") == "https://example.com/a"


@pytest.mark.parametrize("raw", ["", "not-a-url", "/relative/path", "example.com/a"])
def test_missing_scheme_or_host_raises(raw: str) -> None:
    with pytest.raises(ValidationError):
        normalize_url(raw)
