# Create a project

The user creates a named project from the dashboard, and it appears in their project list.

## Sub-features

- New Project dialog (name, optional description, visibility).
- Project list with search and sort.
- Project detail page `/projects/$id`.

## How to get to it (user POV)

Sidebar **Projects** → **New Project** (top right), or the empty-state button **Create your first project**.

## Driving it with Playwright

1. `/projects` → `getByRole("button", { name: "New Project" })`.
2. In `getByRole("dialog", { name: "New Project" })`: fill `textbox "Name"` with a unique name, then click `button "Create"`.
3. Wait for the dialog to close, then for `getByText(name)` in the list.

**Proof:**
- the list shows the name (screenshot before and after)
- `/projects/$id` renders it
- `select name from projects where name = '<name>'` returns one row

## Gotchas

- Two buttons named "New Project" exist when the list is empty. Use `.first()` or scope to the header.
- Names must be unique per instance. Suffix them with `Date.now()`.
