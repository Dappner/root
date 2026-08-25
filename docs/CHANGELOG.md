# Root Changelog

All notable changes to the Root project are documented in this file.

This changelog focuses on user-facing features and breaking changes. For detailed technical changes, see the git history and migration files in `/go-api/migrations/`.

**Format:** Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [Unreleased]

### Planned
- Review item editing (modify prompts/answers)
- Review item deletion with confirmation
- Transcript search functionality
- Kindle import Chrome extension
- Global search across all content types

---

## [0.4.0] - June 2026

### Added - Walk While Talk Flow & Offline Voice Notes (Mobile)
- **Voice Capture Integration:** Added a voice note button to the mobile player, allowing users to record high-quality voice memos (up to 90 seconds) during active media playback.
- **Smart Pause & Resume:** Active playback automatically pauses during recording and resumes once the voice note is captured.
- **Offline Outbox Queue:** Implemented a robust client-side outbox in the mobile `OfflineStore` that saves recordings locally when offline and automatically syncs them to the backend when connectivity is restored.
- **AI Processing Pipeline:** Enqueued voice notes are transcribed and processed by the RAG backend, transforming spoken notes into structured draft citations or captures associated with the source.
- **Pending Outbox Indicators:** Added a `PendingVoiceNotesCallout` component to the mobile source hub overview tab to alert users of pending offline uploads.

### Added - Interactive Graph Views
- **Visual Explorations:** Introduced interactive Graph Views (v1) in the frontend for visual map navigation of citations, notes, and takeaway networks.
- **Semantic Neighborhoods:** Added parallel neighborhood views to help users discover related citations and notes.

### Changed - Multiple Captures per Citation
- **One-to-Many Architecture:** Upgraded the data model and API contracts from a strict 1-to-1 citation-to-capture relationship to support multiple captures (notes) per citation.
- **Frontend Citation Sidebar Redesign:** Overhauled the citation editing modal/dialog with a right column showing a list of capture cards, each with its own inline editing forms.
- **Mobile UI Rendering:** Updated mobile highlights tabs to show a list of child captures underneath each highlight card.

### Changed - Complete Go API Retirement & FastAPI Migration
- **Backend Consolidation:** Completely retired the Go application backend from user traffic. The Python `fast-api` microservice now owns 100% of application endpoints (CRUD, auth, RAG, admin, media import, and review).
- **Codebase Reduction:** Deleted **9,643** lines of handwritten Go code and **8,487** lines of generated sqlc/swagger code, replacing it with **1,924** lines of Python implementation and **904** tests (a ~5:1 implementation code reduction).
- **Go Migration Runner:** The `go-api` service has been stripped down to act solely as the database migration runner and serve a simple `/health` checker.
- **Infrastructure Cleanup:** Deleted Go orval client generation, local proxy routes, and the nginx `/go-api` proxy setup. Both frontend and mobile now derive contracts directly from `fast-api/openapi.json`.

### Changed - Consolidated Video Imports
- **Create Source Integration:** Simplified and merged video imports directly into the general "Create Source" dialog.
- **YouTube Metadata Confirmations:** Added a YouTube import preview step showing channel info and thumbnail confirmation.
- **Discovery Grid Teardown:** Removed separate, standalone discover channels and video grids from the frontend layout.

### Improved - RAG & Audio Systems
- **WebSocket Voice Agent:** Switched the voice agent backend to an ElevenLabs ConvAI WebSocket client, enabling low-latency, real-time conversations over the RAG knowledge base.
- **Unified Transcript Pipeline:** Unified transcript generators for podcasts and videos under a single shared `TranscriptPipeline` utilizing AssemblyAI and Cloudflare R2.
- **Shared Vector Search Core:** Refactored RAG backend methods to share a common vector search execution query core and upsert helper.
- **Trace Playback Progress:** Added Logfire traces to playback progress requests to debug media sync issues.

### Improved - Suggestions & Datetime Consistency
- **Suggestions Enhancements:** Made suggestions and citations mutually exclusive, added a view for dismissed suggestions, and added suggestion validation.
- **Standardized UTC Datetimes:** Consolidated Python datetime utility handlers to write naive UTC datetimes to all PostgreSQL tables, avoiding asyncpg timezone-binding errors.

---

## [0.3.0] - January 2026

### Added - Video Support
- YouTube video import functionality
- Channel management (store channel metadata)
- Video-specific metadata (duration, thumbnail, video URL)
- Transcript generation for videos (via AssemblyAI)
- Video browsing interface at `/videos`
- Channel detail pages at `/videos/channels/[id]`

**Database Changes:**
- Migration 000016: Added `channels` and `videos` tables
- Added channel_platform enum (youtube, vimeo, etc.)
- Added transcript_source field to track transcription service

### Added - Admin User Statistics
- Admin user detail pages with engagement metrics
- 90-day activity trend charts using Recharts
- Weekly aggregation of user activity
- Visual representation of sources, citations, captures, takeaways over time
- User statistics API endpoint

**Database Changes:**
- No schema changes (uses existing tables)

**Design Documents:**

### Changed - Review System to Ad-Hoc Mode
- Simplified review system to user-initiated (ad-hoc) mode
- Priority-based ordering: `(1 / ease_factor) × days_since_last_review`
- Removed time-based scheduling constraints (users can review anytime)
- SM-2 algorithm still runs for data collection and priority calculation
- Deferred: Daily widget, review streak tracking, "due today" filtering

**Design Document:**

### Added - Source Recall Tab
- New "Recall" tab on source detail pages
- Source-scoped view of review items
- Integrated suggestion management in source workflow
- Light stats badges (item counts)
- Quick access to source-specific review sessions
- Three-dot menu on review items with "Practice Now" action

**Design Document:**

### Changed - Transcript Storage
- Renamed `transcript_r2_url` to `transcript_r2_key` for clarity
- Dynamic URL construction instead of storing full URLs
- Better separation of concerns (storage key vs. access URL)

**Database Changes:**
- Migration 000015: Column rename

### Improved - Documentation
- Added comprehensive `docs/FEATURES.md` documenting all features
- Added `docs/ROADMAP.md` with prioritized feature plan
- Added this `docs/CHANGELOG.md` for tracking changes
- Enhanced `docs/PODCAST_TRANSCRIPTS.md` with setup details
- Improved `docs/review-system.md` with ad-hoc mode details

---

## [0.2.0] - Late 2025 / Early 2026

### Added - Podcast & Video Transcripts
- Automated transcript generation via AssemblyAI
- Word-level timestamps with speaker diarization
- Cloudflare R2 storage for transcript JSON files
- Interactive transcript viewer with sentence-by-sentence navigation
- Real-time status updates during generation
- Bidirectional linking (citations ↔ transcript)
- Support for both podcasts and videos

**Database Changes:**
- Migration 000014: Added transcript fields to `podcast_episodes`
- Migration 000016: Added transcript fields to `videos`
- `transcript_status` enum: none, pending, completed, failed
- `transcript_error` for failure messages

**Documentation:**
- `docs/PODCAST_TRANSCRIPTS.md` - Comprehensive setup and usage guide

**External Services:**
- AssemblyAI for transcription
- Cloudflare R2 for storage

### Added - Podcast Support
- Import podcasts via Apple Podcasts URL
- Show and episode normalization (avoid duplication)
- Podcast-specific metadata (duration, audio URL, artwork)
- Episode management per show
- Browsing interface at `/podcasts`
- Show detail pages at `/podcasts/[slug]`

**Database Changes:**
- Migration 000014: Added `shows` and `podcast_episodes` tables
- Platform field for tracking source (Apple, Spotify, etc.)

**Implementation:**
- Backend: `podcast_import_service.go` for Apple Podcasts scraping
- External API: Apple Podcasts public API

### Added - Source Metadata
- Author field for sources (top-level column instead of JSON)
- Published date field for sources
- Backfilled author from existing metadata
- Automatic cleanup of redundant metadata keys

**Database Changes:**
- Migration 000012: Added `author` varchar(255) column
- Migration 000013: Added `published_at` timestamp column

### Added - Review System (Spaced Repetition)
- AI-powered spaced repetition for knowledge retention
- SM-2 algorithm implementation
- Review item generation from takeaways and citations
- Two types: Q&A items and quote recall items
- Four grading options: forgot, hard, good, easy
- Adaptive difficulty adjustment (after 5+ reviews)
- Content score system (citations + 2×takeaways ≥ 12)
- Suggestion inbox for reviewing AI-generated items
- Review session interface at `/review`
- Source-specific review sessions

**Database Changes:**
- Migration 000010: Added `review_items`, `review_suggestions`, `reviews` tables
- Added enums: `review_type`, `review_difficulty`, `review_outcome`, `review_state`, `suggestion_status`
- Polymorphic schema (citations or takeaways as base)

**Implementation:**
- Backend: `review_service.go` implements SM-2 algorithm
- Python RAG service: `review_generator.py` generates suggestions
- LLM: GPT-4o-mini with temperature 0.7

**Documentation:**
- `docs/review-system.md` - Comprehensive review system documentation

### Added - Takeaway Embeddings
- Vector embeddings for takeaways (semantic search)
- Content hashing (SHA256) for staleness detection
- Full-text search with BM25 ranking
- Incremental embedding updates
- Support for takeaways in RAG queries

**Database Changes:**
- Migration 000009: Initial takeaway embeddings (marked dirty)
- Migration 000011: Re-applied after recovery (idempotent)
- Content hash column in `source_takeaways`
- Full-text and BM25 indexes for takeaways

### Added - BM25 Search
- ParadeDB pg_search extension for BM25 ranking
- BM25 indexes on citations and captures
- Superior ranking compared to basic full-text search
- Used in RAG hybrid search

**Database Changes:**
- Migration 000008: Enabled pg_search extension
- Added BM25 indexes on citations and captures

### Improved - Section Ordering
- Fixed order_index for existing sections (all were 0)
- Assigned sequential order based on section ID
- Better sorting and display of sections

**Database Changes:**
- Migration 000007: Data migration for order_index

---

## [0.1.0] - 2025

### Added - Core Foundation

#### Authentication & Authorization
- Better-Auth integration with JWT tokens
- Email/password authentication
- Role-based access (user, admin)
- HTTP-only cookie sessions (`root_session`)
- JWKS endpoint for token validation
- Password reset via email (Resend)
- Invite-only signup mode

**Database Changes:**
- Migration 000001: Created auth schema with user, session, account, verification tables

#### Source Management
- Create and manage sources (books, articles, podcasts, videos, memos)
- Source metadata (title, author, type, publication date)
- Activation model (last_active_at, archived_at)
- Source enrichment (AI summaries)
- Label and tag organization

**Database Changes:**
- Migration 000002: Created `sources` table with metadata JSONB

#### Citations (Highlights)
- Capture quotes, stats, facts, paraphrases
- Speaker attribution for media content
- Context preservation
- Location metadata (timestamps, page numbers)
- Link citations to sections
- Info type categorization

**Database Changes:**
- Migration 000002: Created `citations` table
- Migration 000003: Added `speaker` and `context` columns

#### Captures (Notes)
- Quick capture of thoughts tied to citations
- Finished/unfinished status
- Optional AI processing
- Tag organization
- Soft deletion support

**Database Changes:**
- Migration 000002: Created `captures` table

#### Takeaways (Synthesized Insights)
- High-level insights at source level
- Link takeaways to supporting citations and captures
- Full-text search
- Dedicated pages for viewing and editing

**Database Changes:**
- Migration 000002: Created `source_takeaways`, `source_takeaway_citations`, `source_takeaway_captures` tables

#### Sections & Structure
- Hierarchical organization of source content
- Parent-child section relationships
- Custom ordering
- Optional range-based sections
- Cascade deletion

**Database Changes:**
- Migration 000002: Created `source_sections` table with parent_id for nesting

#### Tags & Labels
- Flexible tagging for citations and captures
- Source-level labels (single label per source)
- Many-to-many relationships
- Tag management interface

**Database Changes:**
- Migration 000002: Created `tags`, `citation_tags`, `capture_tags` tables
- Migration 000004: Added `source_tags` junction and `label` column

### Added - Search & Discovery

#### Full-Text Search
- PostgreSQL native full-text search
- GIN indexes for performance
- English language stemming
- Search across citations, captures, takeaways

**Database Changes:**
- Migration 000006: Added GIN indexes for tsvector

#### Vector Search (Semantic)
- pgvector extension for similarity search
- Cosine similarity ranking
- 1024-dimensional embeddings (Voyage AI)
- Support for citations and captures
- Content hashing for incremental updates

**Database Changes:**
- Migration 000005: Created `rag_embeddings` table
- Enabled pgvector extension

#### RAG Query Interface
- Ask natural language questions over knowledge base
- Stream AI responses (Server-Sent Events)
- Source attribution (inline citations)
- Hybrid search: vector + BM25
- Query interface at `/ask`

**Implementation:**
- Python RAG service with FastAPI
- Voyage AI for embeddings
- OpenAI for LLM
- Supports Ollama for local embeddings

### Added - Admin Features

#### Admin Dashboard
- View all users
- User management interface
- Role-based access control
- Admin-only routes at `/admin`

**Implementation:**
- Backend: `admin_service.go` and `admin_handler.go`
- Better-Auth for authorization

### Added - Observability

#### OpenTelemetry Integration
- Distributed tracing across services
- Metrics collection (Prometheus format)
- Log aggregation
- Jaeger for trace visualization
- Grafana dashboards

**Implementation:**
- OpenTelemetry SDK in Go and Python
- Docker Compose setup in `/observability`

**Documentation:**
- `docs/observability.md`

### Added - UI Components

#### Command Palette
- Keyboard shortcut (Cmd/Ctrl+K)
- Search sources by title
- Quick navigation
- Recency-based sorting
- Visit tracking (localStorage)

**Note:** Backend sync for cross-device tracking is planned

#### Home Dashboard
- Recently active sources
- Quick actions
- Activity overview
- Navigation shortcuts
- Landing page at `/`

---

## Migration History Summary

Database schema evolution timeline:

| Migration | Description | Impact |
|-----------|-------------|--------|
| 000001 | Authentication schema | Better-Auth foundation |
| 000002 | Core app schema | Sources, citations, captures, sections, tags, takeaways |
| 000003 | Speaker & context fields | Add speaker and context columns to citations |
| 000004 | Source tagging | Labels and source tags tables |
| 000005 | pgvector RAG | Vector search foundation table |
| 000006 | Full-text search | GIN indexes for full-text search |
| 000007 | Section ordering fix | Fix order_index data migration |
| 000008 | BM25 indexes | pg_search BM25 indexing extension |
| 000009 | Review system | Spaced repetition schema (review_items, suggestions, reviews) |
| 000010 | Takeaway embeddings v2 | Cleaned takeaway embeddings schema |
| 000011 | Source metadata | Dedicated columns for author and published_at |
| 000012 | Podcast normalization | Shows and podcast episodes tables |
| 000013 | Video support | Channels and videos tables |
| 000014 | Remove deprecated columns | Schema cleanup of unused columns |
| 000015 | Section summaries | Added source section summaries |
| 000016 | Migrate citation locations | Refactored location-tracking columns |
| 000017 | Podcast R2 audio | Caching podcast audio in R2 storage |
| 000018 | Notes | Added notes table |
| 000019 | Note kind | Added classification kind to notes |
| 000020 | Note source scope | Added source scoping to notes |
| 000021 | Source status | Added status tracking column to sources |
| 000022 | Section subtitles | Added subtitle column to source sections |
| 000023 | Collections | Created collections table and schema |
| 000024 | PDF storage key | Added PDF R2 storage object key column |
| 000025 | Source status stages | Upgraded source status enum to four stages |
| 000026 | Refactored embeddings | Centralized RAG embeddings schema & transcript statuses |
| 000027 | Voice suggestions | Added tables/fields for offline voice notes |
| 000028 | Link suggestions | Linked suggestions directly to citations/captures |
| 000029 | Section generation mode | Track if sections were generated manually or by AI |
| 000030 | Takeaway JSON body | Added JSONB body support for takeaways |
| 000031 | Recompute active time | Updated and recomputed last active times for sources |
| 000032 | Suggestion action detail | Added action tracking fields for entity creation in suggestions |

---

## Breaking Changes

### [0.4.0] - Go API Retirement
- **Changed:** Completely removed the Go application server endpoints and Next.js proxy proxying.
- **Impact:** Frontend and mobile now query the Python FastAPI backend directly. Generated Go API clients and types have been removed.
- **Migration:** Schema migrations still run via Go runner (`go-api`). Ensure local configurations map directly to the FastAPI server port/URL.

### [0.4.0] - Multiple Captures per Citation
- **Changed:** Shifted citation-capture association from a 1-to-1 model to a 1-to-many list format.
- **Impact:** API request/response contracts for creating citations and highlights updated to lists.
- **Migration:** UI dialogs refactored; custom hooks and state components now process arrays of captures instead of singular capture properties.

### [0.3.0] - Review System Ad-Hoc Mode
- **Changed:** Review system no longer filters by due date
- **Impact:** All items shown in review sessions (ordered by priority)
- **Migration:** No database changes needed, UI updated automatically

---

## Deprecations

### Planned for Removal

None at this time. All features are actively maintained.

---

## Security Updates

### [0.1.0] - JWT Security
- Implemented JWKS-based token validation
- HTTP-only cookies for session storage
- Secure token rotation
- Protection against CSRF attacks

---

## Performance Improvements

### [0.4.0]
- **Shared Vector Search Core:** Refactored search backend, eliminating redundant db calls and simplifying execution layers.
- **Batch Embeddings Processing:** Optimized text embedding pipelines via batched API requests to Voyage AI.

### [0.2.0]
- BM25 ranking for better search results (Migration 000008)
- Content hashing for incremental embedding updates (Migration 000009/000011)
- Section ordering optimization (Migration 000007)

### [0.1.0]
- GIN indexes for full-text search (Migration 000006)
- Vector indexes for semantic search (Migration 000005)
- Composite indexes on user_id + created_at for fast filtering

---

## Known Issues

### Current Limitations

- **Command Palette:** Recency tracking stored in localStorage (not synced across devices)
- **Review System:** Scheduled mode deferred (ad-hoc mode only)

### Workarounds

- **Cross-device recency:** Backend storage for visit tracking is planned for Q1 2026
- **Scheduled reviews:** Algorithm collects data for future scheduled mode

---

## Acknowledgments

### External Services & Libraries

- **Better-Auth** - Authentication system
- **AssemblyAI** - Transcript generation
- **Cloudflare R2** - Object storage
- **Voyage AI** - Text embeddings
- **OpenAI** - LLM (GPT-4o-mini)
- **ParadeDB** - BM25 search (pg_search)
- **pgvector** - Vector similarity search
- **Recharts** - Data visualization
- **shadcn/ui** - UI components
- **Next.js** - Frontend framework
- **Go** - Backend language
- **Python** - RAG service
- **PostgreSQL** - Database

---

## Related Documentation

- **Features:** `/docs/FEATURES.md` - Complete feature documentation
- **Roadmap:** `/docs/ROADMAP.md` - Future plans and priorities
- **Architecture:** `/AGENTS.md` - System architecture overview
- **Product:** `/docs/product_overview.md` - Product vision
- **Review System:** `/docs/review-system.md` - Detailed review documentation
- **Transcripts:** `/docs/PODCAST_TRANSCRIPTS.md` - Transcript setup and usage
- **Deployment:** `/docs/DEPLOY.md` - Deployment guide

---

## Version Numbering

Root follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version when making incompatible API changes or major architectural changes
- **MINOR** version when adding functionality in a backward-compatible manner
- **PATCH** version when making backward-compatible bug fixes

**Current Version:** 0.4.0 (pre-1.0, rapid development phase)

---

**Note:** This changelog started in January 2026. Prior changes were reconstructed from git history and migration files. Future changes will be documented as they occur.
