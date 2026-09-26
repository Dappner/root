# Highlights → embeddings

Highlights are what the user captures from a source: quotes (citations) and comments/thoughts (captures). Saving one triggers a background task that embeds it with Voyage and writes to `rag_embeddings`. Ask and search depend on those embeddings.

## Sub-features

- **Quote:** the `Add Citation` dialog with Quote/Paraphrase, `Text *`, speaker, context, pages, and inline "Thoughts" (captures).
- **Comment:** a capture on the source.
- **Highlights page** `/library/$id/highlights`: sections (`Create Section`), and moving highlights between sections.
- **Embedding side effect:** a `rag_embeddings` row with `citation_id` or `capture_id`, `model = voyage-4-large`, 1024 dims.

## How to get to it (user POV)

Source detail `/library/$id` → **Quote** or **Comment** button. The Highlights tab (`/library/$id/highlights`) lists them, and its empty state has **Add your first quote**.

## Driving it with Playwright

Scenario: `node run.mjs quote-embed-ask`, first half.

1. Create a source (see library-sources).
2. On `/library/$id`, click `button "Quote"`.
3. In `dialog "Add Citation"`, fill `textbox "Text *"`, then click `button "Create Citation"`.
4. `/library/$id/highlights` shows the quote text.

**Proof:**
- the `citations` row exists
- `rag_embeddings` has a row for that `citation_id`
- `.verify/run/i0/fake-providers.jsonl` has a new `"op": "embed"` line with `"input_type": "document"`

## Gotchas

- **Known product bug (found 2026-09-26, still open):** creating a citation never embeds it. `POST /rag-api/citations` schedules `generate_citation` as a FastAPI `BackgroundTask`. With FastAPI 0.128, the request's `get_db` session commits *after* background tasks run, so the task's own session can't see the uncommitted row. It then returns silently: no Voyage call, no log line.
  - Reproduced in-process: the candidate lookup returns `NONE` for the just-created id.
  - The same pattern likely affects captures, takeaways and section summaries.
  - Until it's fixed, the scenario's embed assertions fail. That is the correct outcome.
  - Workarounds that make it *look* green (calling the service directly, a refresh endpoint) are not proof of this path.
- Embedding vectors come from the fake: hashed bag-of-words. Texts that share words score as similar; nothing more semantic than that.
