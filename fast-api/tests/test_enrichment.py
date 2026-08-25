"""Unit tests for the OpenGraph HTML parser (no network)."""

from __future__ import annotations

from app.integrations.enrichment import is_youtube_url, parse_opengraph


def test_prefers_og_title() -> None:
    html = """
    <html><head>
      <meta property="og:title" content="OG Title" />
      <meta name="twitter:title" content="Twitter Title" />
      <title>Page Title</title>
    </head></html>
    """
    assert parse_opengraph(html).title == "OG Title"


def test_falls_back_to_twitter_title() -> None:
    html = """
    <html><head>
      <meta name="twitter:title" content="Twitter Title" />
      <title>Page Title</title>
    </head></html>
    """
    assert parse_opengraph(html).title == "Twitter Title"


def test_falls_back_to_page_title() -> None:
    html = "<html><head><title>Page Title</title></head></html>"
    assert parse_opengraph(html).title == "Page Title"


def test_trims_medium_suffix() -> None:
    html = '<html><head><meta property="og:title" content="My Post - Medium" /></head></html>'
    assert parse_opengraph(html).title == "My Post"


def test_description_prefers_og() -> None:
    html = """
    <html><head>
      <meta property="og:description" content="OG Desc" />
      <meta name="description" content="Meta Desc" />
    </head></html>
    """
    assert parse_opengraph(html).description == "OG Desc"


def test_description_falls_back_to_name() -> None:
    html = '<html><head><meta name="description" content="Meta Desc" /></head></html>'
    assert parse_opengraph(html).description == "Meta Desc"


def test_site_name_extracted() -> None:
    html = '<html><head><meta property="og:site_name" content="Example Co" /></head></html>'
    assert parse_opengraph(html).site_name == "Example Co"


def test_empty_document_yields_empty_metadata() -> None:
    result = parse_opengraph("<html><head></head><body></body></html>")
    assert result.title == ""
    assert result.site_name == ""
    assert result.description == ""


def test_is_youtube_url() -> None:
    assert is_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert is_youtube_url("https://youtu.be/dQw4w9WgXcQ")
    assert not is_youtube_url("https://example.com/article")
