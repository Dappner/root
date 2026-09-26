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
2. Wait for text starting with `[stub-llm]`. That is the fake Gemini's reply streamed through the real agent → SSE → UI path.

**Proof:**
- the answer is rendered under the question
- `fake-providers.jsonl` has `"provider": "gemini"` lines
- `events.json` shows the `/rag-api/ask...` calls returning 2xx

## Gotchas

- Only Gemini is stubbed. Picking an OpenAI or Anthropic model in the picker hits the real APIs with blank keys and fails. That is expected here and is not a product bug.
- The fake never issues tool calls, so the agent answers after one turn. Search tools only run if the model asks for them, so retrieval quality can't be judged here.
- The `tiktoken` download from `openaipublic.blob.core.windows.net` is blocked by the cloud proxy. The answer still completes.
