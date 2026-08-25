# FastAPI Agent Tools

Succinct inventory of tools exposed to Jetflow agents in the FastAPI RAG service.

## RAG Agent

- `search` - semantic/hybrid search across captures, citations, takeaways, and source section summaries. Supports `entity_types`, `source_ids`, and `source_types`.
- `list_user_sources` - lists saved sources with IDs, titles, and types so the agent can resolve source names before searching.

## Reflection Agent

- `get_source_context` - loads a source's highlights, notes, existing takeaways, and section summaries directly. Use this for broad source-scoped synthesis and takeaway drafting.
- `search` - source-scoped semantic/hybrid search. Reflection calls must include the current `source_id`.
- `suggest_uncaptured_citations` - finds citations in the current source that do not have linked captures/notes yet.

## Post-Answer Agent

- `followup_agent` - small Jetflow agent with one exit action. Runs after the main reflection answer is complete and returns 2-4 personalized follow-up prompt chips.

## Transcript Scout Direction

For podcast/video transcript work, prefer a nested-agent tool rather than exposing R2 details to the main reflection agent:

- `transcript_scout` - fast, cheap Jetflow scout that reads transcript chunks for a source and returns factual spans with timestamps.
- `research_transcript` - parent-agent tool wrapper around `transcript_scout`, e.g. query in, timestamped findings out.

R2 should remain the raw transcript artifact store. The tool should accept semantic inputs like `source_id`, `query`, `around_citation_id`, or timestamp bounds, then FastAPI can resolve podcast/video IDs and fetch or search transcript content internally.

## Stream Display Contract

Tool stream events include a `display` object intended for frontend rendering:

- `label` - short action label for the status badge.
- `title` - primary human-readable description.
- `detail` - optional secondary context.
- `summary` - optional completed-state text.
- `result` - optional compact result count or status.

The frontend should prefer `display` and treat raw `name`/`args` as fallback/debug data.

## Stream Events

- `delta` - append text to the live assistant answer.
- `answer_done` - the main answer text is complete; citations are final.
- `followups` - optional post-answer prompt chips generated after `answer_done`.
