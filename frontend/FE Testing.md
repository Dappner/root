# FE Testing

Run targeted tests first:

```bash
pnpm test:graph
pnpm test:command-palette
```

Run checks before pushing:

```bash
pnpm typecheck
pnpm lint
pnpm e2e -- --headless
```

Prefer pure logic tests for coordinate math, parsing, ranking, and reducers. Use Cypress only for browser behavior that cannot be verified deterministically in Node.
