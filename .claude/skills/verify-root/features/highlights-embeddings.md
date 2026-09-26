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

- **Fixed 2026-09-26:** before the fix, creating a citation never embedded it. The route's `get_db` committed only *after* FastAPI ran the background embedding task, so the task couldn't see the row and skipped silently.
  - Routes that take `BackgroundTasks` now use `Depends(get_db, scope="function")`, enforced by `fast-api/tests/test_background_task_db_scope.py`.
  - A skipped row now logs `... embedding skipped: row not found`. Grep `fast-api.log` for it when this fails.
  - Rows created before the fix still lack embeddings until the admin refresh backfills them.
- Voyage calls go through the real `VoyageEmbedder` → SDK → the HTTP fake (`EMBEDDING_BASE_URL`). To bypass HTTP entirely, set `EMBEDDING_PROVIDER=fake` (the in-process `FakeEmbedder`); nothing is logged to `fake-providers.jsonl` then.
- Embedding vectors come from the fake: hashed bag-of-words. Texts that share words score as similar; nothing more semantic than that.
