# Command Palette

The command palette is now split into a small headless core plus a Root-specific app adapter.

## Current Shape

`src/components/command-palette/core/`
- Generic context resolution
- Plugin-based action contribution
- Intent collapse / precedence
- Query + shortcut matching
- Generic section building

`src/features/command-palette/app/`
- Root-specific contexts (`default`, `library`, `source`, `collection`)
- Root-specific plugins and action wiring
- Flows and pickers for multi-step business actions

`src/components/command-palette/components/`
- Presentational row/group pieces for the palette UI

`src/features/command-palette/command-palette.tsx`
- Palette shell
- Keyboard handling
- Rendering of resolved sections and picker state

## Mental Model

1. Resolve all active contexts from route state.
2. Run plugins against that layered context set.
3. Let plugins rebalance actions when needed.
4. Filter redundant actions and collapse duplicate intents.
5. Rank visible actions with one matcher that understands both search text and shortcut-like input.
6. Render grouped sections.

## Shortcuts

- `Cmd/Ctrl+K` opens the palette globally.
- Other shortcuts are palette-local ranking hints, not app-wide hidden commands.
- Queries like `g ` and `g a` strongly boost actions whose shortcuts begin with those tokens.

## Tests

The current MVP test coverage is logic-only and lives in:

- [`command-palette.test.ts`](../../../tests/components/command-palette/core/command-palette.test.ts)

It covers:
- layered context resolution
- plugin precedence by intent
- plugin-driven priority rebalancing
- shortcut-prefix ranking
- exact shortcut ranking

Run with:

```bash
pnpm test:command-palette
```
