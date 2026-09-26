# PDF sources

A PDF-type source stores its file in object storage (R2). Users read and highlight it in the PDF viewer slideover.

## Sub-features

- Create a source with Type **PDF** (Add Source dialog).
- Upload from the source page (`Choose File`, `accept=application/pdf`) or from the viewer's **Upload PDF**. Max 50MB and 500 pages. Replacing a PDF deletes highlights derived from the old one.
- Viewer slideover (the `PDF [P]` button): zoom, fit, and highlighting that creates citations with `pdf_v1` locations.
- "Open in new tab" through a presigned URL (`GET /rag-api/sources/{id}/pdf/url`).
- Deleting the source removes the stored object.

## How to get to it (user POV)

Library → **Add Source** → Type **PDF** → create → the source page shows **Choose File** and **PDF [P]**.

## Driving it with Playwright

Scenario: `node run.mjs pdf-upload`.

1. Select the type by clicking its label: `dialog.getByText("PDF", { exact: true })`. The radio input itself is visually hidden.
2. `setInputFiles` on `input[type=file][accept='application/pdf']`. The scenario generates a one-page PDF, and the step waits for `POST /rag-api/sources/{id}/pdf` to return 2xx.

3. Open the viewer (`PDF [P]`) and wait for the page's text ("Verify PDF upload") in the pdf.js text layer.
4. Legacy-row check: remove `page_count` from the row, reload, and open the viewer again.

**Proof:**
- `sources.pdf_object_key` is set, and `metadata.page_count` is `1`.
- The object is in the S3 stand-in. The bucket listing `GET $S3_URL/root-verify?list-type=2&prefix=<key>` is open; objects themselves are private, so unsigned GET and HEAD return 403.
- The presigned URL from `/pdf/url` serves bytes starting `%PDF-` of the uploaded size. Fetch it with `page.request`, not `window.fetch`, because the bucket sends no CORS headers.
- The viewer renders the page, both freshly uploaded and for a legacy row.

## Gotchas

- **Fixed 2026-09-26:** the viewer never showed an uploaded PDF ("No PDF uploaded • N B").
  - Cause: `hasPdf` depended on `metadata.page_count`, which the backend stripped on every upload and nothing ever set.
  - The backend now counts pages with `pypdf` on upload. It stores `page_count`, rejects unreadable or over-500-page files with 400, and citation bounds-validation uses the stored count.
  - The viewer treats `size_bytes` as enough, so PDFs uploaded before the fix open without a backfill.
  - `compare.sh HEAD~1 pdf-upload` shows the base failing.
- The annotator's `PdfLoader` used to fetch its pdf.js worker from `unpkg.com`, which the cloud proxy blocks. It now gets the bundled worker (`workerSrc={PDF_WORKER_SRC}`), so the viewer works offline and prod no longer depends on that CDN.
