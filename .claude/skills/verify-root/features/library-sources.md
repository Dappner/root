# Library & sources

A source is a book, video, article, PDF or podcast the user is working through. The library lists sources; each source has a detail page that holds its highlights, notes and takeaways.

## Sub-features

- Add a source manually: **Add Source** dialog with Type (Book/Video/Article/PDF), `Title *`, `Author`, and an optional "Add details" section.
- Library list: search box `Search library...`, type filters (`All`, `Books`, `Articles`, `Videos`, `Podcasts`, `PDFs`, with keyboard shortcuts A/B/R/V/P/D), and a "Hide in collections" toggle.
- Source detail `/library/$id`:
  - status button (`To do` → in progress → done)
  - tags (`Add tag`)
  - summary (`Edit`)
  - "About this source"
  - Recent notes
  - Key takeaways
  - `More actions` menu (edit/archive/delete)
- Adding a Video or PDF source goes through YouTube or R2 upload. Those can only be reached partially here: R2 is moto, YouTube isn't stubbed.

## How to get to it (user POV)

Sidebar **Library** → `/library` → **Add Source** (top right) or **Add your first source** (empty state). The home page (`/`) also has **Add source**. Clicking a source card opens `/library/$id`.

## Driving it with Playwright

Scenario: `node run.mjs library-add-source`.

1. `/library` → `getByRole("button", { name: "Add Source" })`.
2. `getByRole("dialog", { name: "Add Source" })`:
   - fill `textbox "Title *"` and `textbox "Author"`
   - click `button "Create Source"`
   - wait for the dialog to close
3. Revisit `/library`, click the card by its title text, and wait for the URL `/library/\d+`.

**Proof:** the card is listed; the detail page shows the title and author; and this query returns `book|Verify Author` for that title:

```sql
select type, author from sources s join auth."user" u on u.id = s.user_id where u.email = 'verify@example.com'
```

## Gotchas

- `/sources` is gone; old Cypress specs still use it. Sources live under `/library`.
- On a busy `i0` instance the list isn't empty. Always use unique titles (`Date.now()`) and match by title, never by position.
