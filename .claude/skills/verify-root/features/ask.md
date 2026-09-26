# Ask (RAG chat)

Ask is chat over the user's own knowledge base. A Jetflow agent searches the user's citations and notes (hybrid vector + BM25), then answers with the selected model. Answers stream back over SSE.

## Sub-features

- Question box `Ask anything...`, send with Enter or the send button.
- `Dictate question` (voice; not stubbed).
- Model picker, default `Gemini 3.6 Flash`, and a reasoning picker (`Reasoning: Medium`).
- `Clear Chat`.
- Follow-up questions; answers show citations when search returns hits.

## How to get to it (user POV)

Sidebar **Ask** → `/ask`.

## Driving it with Playwright

Scenario: `node run.mjs quote-embed-ask`, second half.

1. `/ask`: fill `textbox "Ask anything..."` and press Enter.
2. Wait for `[fake-llm] Stubbed answer`. The fake LLM first calls the real `search` tool (you'll see "Searching for …" and "Found N result(s)"), then answers `… Tool results: 1 …`. With `VERIFY_LLM=http` the answer is `[stub-llm] …` instead, and no tool is called.

**Proof:**
- the answer is rendered under the question
- in `http` mode, `provider-calls.jsonl` has `"provider": "gemini"` lines
- `events.json` shows the `/rag-api/ask...` calls returning 2xx
- in `fake` mode, `provider-calls.jsonl` shows the search's `"input_type": "query"` embed and a `rerank`

## Gotchas

- In `fake` mode every model in the picker works (the answer names the model). In `http` mode only Gemini does.
- The fake LLM calls `search` exactly once, with your question verbatim, then answers. Other tools never run, and retrieval quality can't be judged here: the vectors are bag-of-words.
- The `tiktoken` download from `openaipublic.blob.core.windows.net` is blocked by the cloud proxy. The answer still completes.
