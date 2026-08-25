# Mobile (Expo) - Developer Guide

Expo React Native client for Root. Connects to the deployed dev/prod environments — no local backend needed.

## Key Commands

```bash
expo start               # Start dev server
expo run:ios             # Build and run on iOS simulator/device
cd ios && pod install    # Required after adding packages with native code (e.g. react-native-svg)
npx orval                # Regenerate API types from swagger/openapi specs
pnpm typecheck           # TypeScript check
```

## API Type Generation

Types are generated from the same spec as the frontend:

- **FastAPI** → `lib/api/rag-generated.ts` (from `../fast-api/openapi.json`)

**Always run `npx orval` after any backend API change.** Never manually edit generated files.

## Architecture

- **Expo Router** (file-based routing) with Stack + Tabs navigators
- **React Query** for data fetching — same patterns as frontend
- **`lib/api/fetcher.ts`** — `mobileFetch` injects auth cookie via `authClient.getCookie()`
- **`lib/api/rag-generated.ts`** — FastAPI client (all CRUD + RAG + playback progress)
- **`lib/utils.ts`** — shared utilities (`formatTimestamp`, `getSourcePlaybackPosition`, `SourcePlaybackMetadata`)

## Metadata Typing

`SourceDTO.metadata` is typed as `{ [key: string]: unknown }` in the generated types — this is as specific as the FastAPI OpenAPI spec expresses for a dynamic JSON column. The playback fields (`current_position`, `duration`, `completed`, `last_listened_at`) are written by FastAPI and defined as `SourcePlaybackMetadata` in `lib/utils.ts`. Always use `getSourcePlaybackPosition(source.metadata)` rather than casting inline.

## Icons

Uses **phosphor-react-native** + **react-native-svg**. Always import icons directly from their file path to avoid Metro bundler barrel-export issues:

```ts
// ✅ Correct
import { Play } from "phosphor-react-native/src/icons/Play";

// ❌ Breaks at runtime (Metro can't resolve conditionally)
import { Play } from "phosphor-react-native";
```

Do NOT use conditionally-rendered Phosphor icons (icons chosen at runtime based on props/state) — Metro may fail to resolve them. Use plain View/Text alternatives for dynamic icon slots.

## Player

- `PlayerProvider` lives at the root layout (`app/_layout.tsx`) so audio persists across navigation
- `MiniPlayer` is rendered in `app/(app)/_layout.tsx` as an absolute overlay — always visible regardless of route
- `play(track, initialPositionSec?)` resumes from saved position
- Playback progress is saved to FastAPI (`PUT /rag-api/playback/sources/{id}/progress`) on play, pause, every 10s while playing, and on dismiss

## Structure

```
app/
  _layout.tsx                  # Root: QueryClient + PlayerProvider
  (app)/
    _layout.tsx                # App shell: Stack + MiniPlayer overlay
    (tabs)/                    # Tab navigator (Ask, Podcasts, Home, Library, Settings)
    sources/[id]/              # Source hub + sub-routes (highlights, takeaways, sections)
    player.tsx                 # Full-screen player modal
features/
  player/                      # context.tsx, mini-player.tsx, downloads.ts
  sources/                     # hooks.ts, api.ts
  podcasts/                    # hooks.ts, api.ts
  home/                        # hooks.ts, api.ts
lib/
  api/                         # fetcher.ts, rag-generated.ts
  utils.ts                     # formatTimestamp, getSourcePlaybackPosition
  auth-client.ts
  config.ts
```
