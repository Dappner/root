# verify-root feature map

These are the user-facing features of the Root web app and how to prove each one works with the verify-root harness. Each file has four sections: **Sub-features**, **How to get to it (user POV)**, **Driving it with Playwright**, and **Gotchas**.

| Feature | File | Scenario | Last live result |
|---|---|---|---|
| Library & sources | [library-sources.md](library-sources.md) | `library-add-source` | pass |
| Highlights → embeddings | [highlights-embeddings.md](highlights-embeddings.md) | `quote-embed-ask` (first half) | **fail: product bug** (see file) |
| Ask (RAG chat) | [ask.md](ask.md) | `quote-embed-ask` (second half) | pass (stub LLM) |
| Notes | [notes.md](notes.md) | none yet (recipe in file) | reached: editor opens, row created |
| Auth & admin | [auth-admin.md](auth-admin.md) | covered by every scenario's login; admin recipe in file | pass |

These features aren't mapped yet, so add a file when you touch one:
- collections (`/library/collections`)
- takeaways (`/library/$id/takeaways`)
- reflect (`/library/$id/reflect`)
- transcripts, podcasts and videos (these need AssemblyAI or YouTube, which aren't stubbed)
- graph (`/graph`)
- suggestions (`/suggestions`)
- command palette
- voice (ElevenLabs, not stubbed)
- profile

A proof that only drives one convenient entry point is incomplete when a file here lists others.
