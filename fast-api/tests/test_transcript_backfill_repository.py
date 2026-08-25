"""Smoke tests on the moved BACKFILL SQL — guard against accidental edits
that drop the source-type scoping or the page-range matching."""

from app.repositories.transcript_backfill_repository import (
    _BACKFILL_AV_CITATION_SECTIONS_SQL,
    _BACKFILL_BOOK_CITATION_SECTIONS_SQL,
    _CLEAR_UNLINKED_AV_CAPTURE_SECTIONS_SQL,
)


def test_backfill_av_citation_sections_is_scoped_to_av_sources():
    sql = _BACKFILL_AV_CITATION_SECTIONS_SQL.text
    assert "src.type IN ('podcast', 'video')" in sql
    assert "JOIN sources src ON src.id = cit.source_id" in sql


def test_backfill_book_citation_sections_uses_book_page_ranges():
    sql = _BACKFILL_BOOK_CITATION_SECTIONS_SQL.text
    assert "src.type = 'book'" in sql
    assert "pageStart" in sql
    assert "book_loc.page_start >= ss.range_start" in sql
    assert "book_loc.page_start <= ss.range_end" in sql
    assert "matched.new_section_id IS NOT NULL" in sql


def test_unlinked_capture_cleanup_does_not_target_books():
    sql = _CLEAR_UNLINKED_AV_CAPTURE_SECTIONS_SQL.text
    assert "src.type IN ('podcast', 'video')" in sql
    assert "src.type = 'book'" not in sql
