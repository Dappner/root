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

**Proof:**
- `sources.pdf_object_key` is set.
- The object is in the S3 stand-in. The bucket listing `GET $S3_URL/root-verify?list-type=2&prefix=<key>` is open; objects themselves are private, so unsigned GET and HEAD return 403.
- The presigned URL from `/pdf/url` serves bytes starting `%PDF-` of the uploaded size. Fetch it with `page.request`, not `window.fetch`, because the bucket sends no CORS headers.

## Gotchas

- **Open product bug (found 2026-09-26, present before the ObjectStore refactor):** after a successful upload the viewer says "No PDF uploaded • N B" and never loads the file.
  - `hasPdf` in `source-pdf-slideover/index.tsx` depends on `metadata.page_count`.
  - The backend's `_normalize_pdf_metadata` removes `page_count` on every upload, and the frontend computes the page count (`getPdfPageCount`) but never sends it.
  - The scenario records `viewer_shows_pdf` (currently `false`) instead of asserting it. Flip it to an assertion once the bug is fixed.
