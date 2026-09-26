# Notes

Free-form rich-text notes (Tiptap), either standalone or linked to a source.

## Sub-features

- Notes list `/notes`: `Search notes…`, `Sort: Updated`, `List view` / `Grid view`, `New Note`.
- Note editor `/notes/$id`:
  - title textbox (accessible name `Untitled` until set)
  - Tiptap body
  - `Saved` indicator
  - `Type:` toggle (`NOTE` / insight)
- Source-scoped notes under `/library/$id/notes`.

## How to get to it (user POV)

Sidebar **Notes** → `/notes` → **New Note**. This creates the note right away and opens `/notes/$id`.

## Driving it with Playwright

There's no scenario file yet. Write `harness/scenarios/notes-create.mjs` the first time you need it:

1. `/notes` → `getByRole("button", { name: "New Note" }).first()`. The empty state shows a second button with the same name.
2. `page.waitForURL(/\/notes\/\d+/)`.
3. `getByRole("textbox", { name: "Untitled" }).fill(title)`.
4. Type the body into `locator(".ProseMirror")`.
5. Wait for `Saved`.

**Proof:** the note shows in `/notes` by title, and this query returns the text you typed:

```sql
select title, plain_text, kind from notes where title = '<title>'
```

## Gotchas

- `New Note` creates a row before you type anything. Empty `Untitled` notes pile up on a reused instance.
- The editor body isn't exposed as a named textbox in the ARIA tree; target `.ProseMirror`.
