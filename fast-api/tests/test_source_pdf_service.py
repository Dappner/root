"""Server-side PDF page counting used by uploads."""

import io

import pytest
from pypdf import PdfWriter

from app.core.exceptions import ValidationError
from app.services.source_pdf_service import MAX_PDF_PAGES, count_pdf_pages


def _pdf(pages: int) -> bytes:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_counts_pages() -> None:
    assert count_pdf_pages(_pdf(2)) == 2


@pytest.mark.parametrize("data", [b"", b"not a pdf", b"%PDF-1.4 truncated"])
def test_rejects_unreadable(data: bytes) -> None:
    with pytest.raises(ValidationError):
        count_pdf_pages(data)


def test_rejects_too_many_pages() -> None:
    with pytest.raises(ValidationError, match=str(MAX_PDF_PAGES)):
        count_pdf_pages(_pdf(MAX_PDF_PAGES + 1))
