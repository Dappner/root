# Root Features Documentation

This document provides a comprehensive overview of all features implemented in Root, a knowledge management system for capturing, synthesizing, and recalling insights from reading.

**Last Updated:** January 2026

---

## Table of Contents

1. [Core Features](#core-features)
2. [Knowledge Capture](#knowledge-capture)
3. [Content Organization](#content-organization)
4. [AI-Powered Features](#ai-powered-features)
5. [Admin Features](#admin-features)
6. [Technical Features](#technical-features)

---

## Core Features

### 1. Source Management

**Description:** Central repository for books, articles, podcasts, videos, and other content sources.

**Key Capabilities:**
- Create and manage sources with metadata (title, author, type, publication date)
- Support for multiple source types: books, articles, podcasts, videos, PDFs
- Source activation model: track last active time, mark as done/archived
- Label and tag organization
- Rich metadata storage (JSON-based for flexibility)
- AI-powered source enrichment (summaries)

**Database Schema:**
- `sources` table (Migration 000002)
- Extended with `author` field (Migration 000012)
- Extended with `published_at` field (Migration 000013)

**UI Routes:**
- `/sources` - List all sources
- `/sources/[sourceId]` - Source detail page with tabs

---

### 2. User Authentication & Authorization

**Description:** Secure authentication system with role-based access control.

**Key Capabilities:**
- Email/password authentication via Better-Auth
- JWT-based session management
- HTTP-only cookie storage (`root_session`)
- JWKS (JSON Web Key Set) for token validation
- Role-based permissions (user, admin)
- Password reset via email (Resend integration)
- Invite-only signup mode (configurable via `ENABLE_SIGNUP`)

**Database Schema:**
- `auth` schema with user, session, account, verification tables (Migration 000001)

**UI Routes:**
- `/login` - Sign in page
- `/signup` - Sign up page (when enabled)
- `/profile` - User profile management

**Implementation:**
- Frontend: Better-Auth in Next.js (`/api/auth/[...all]`)
- Backend: JWT validation via JWKS in Go and Python services
- See `docs/auth.md` for detailed architecture

---

## Knowledge Capture

### 3. Citations (Highlights)

**Description:** Capture specific quotes, stats, facts, or paraphrases from sources.

**Key Capabilities:**
- Create citations from source content
- Support for different info types: quote, stat, fact, paraphrase
- Speaker attribution (for podcasts/videos)
- Context preservation
- Location metadata (timestamps for media, page numbers for books)
- Link citations to sections
- Full-text search (PostgreSQL GIN indexes)
- BM25 ranking (pg_search extension)
- Vector embeddings for semantic search (pgvector)

**Database Schema:**
- `citations` table (Migration 000002)
- Extended with `speaker` and `context` (Migration 000003)
- Full-text search indexes (Migration 000006)
- BM25 indexes (Migration 000008)
- Vector embeddings in `rag_embeddings` (Migration 000005)

**UI Routes:**
- Citations displayed in source detail page → Highlights tab
- Create/edit via dialogs

---

### 4. Captures (Quick Notes)

**Description:** Capture your own thoughts and insights tied to citations.

**Key Capabilities:**
- Create captures linked to citations
- Quick capture mode (unfinished/finished status)
- Optional AI processing for structure
- Tag organization
- Full-text search
- BM25 ranking
- Vector embeddings for semantic search
- Soft deletion support

**Database Schema:**
- `captures` table (Migration 000002)
- Vector embeddings in `rag_embeddings` (Migration 000005)

**UI Routes:**
- Captures displayed alongside citations in Highlights tab

---

### 5. Takeaways (Synthesized Insights)

**Description:** High-level insights and key learnings synthesized from a source.

**Key Capabilities:**
- Create takeaways at source level
- Link takeaways to supporting citations and captures
- Full-text search on title and body
- BM25 ranking
- Vector embeddings for semantic search
- Content hashing for staleness detection (SHA256)

**Database Schema:**
- `source_takeaways` table (Migration 000002)
- `source_takeaway_citations` junction table
- `source_takeaway_captures` junction table
- Content hashing support (Migration 000009, 000011)
- Full-text and BM25 indexes (Migration 000009, 000011)

**UI Routes:**
- `/sources/[sourceId]/takeaways/new` - Create takeaway
- `/sources/[sourceId]/takeaways/[id]` - View takeaway
- `/sources/[sourceId]/takeaways/[id]/edit` - Edit takeaway

---

## Content Organization

### 7. Sections & Structure

**Description:** Organize source content into hierarchical sections.

**Key Capabilities:**
- Create nested sections (parent-child relationships)
- Custom ordering (order_index)
- Optional range-based sections (start/end positions)
- Section kinds for categorization
- Cascade deletion (delete section → delete child sections)

**Database Schema:**
- `source_sections` table (Migration 000002)
- Fixed order_index handling (Migration 000007)

**UI Routes:**
- Section management in source detail page → Overview tab

---

### 8. Tags

**Description:** Flexible tagging system for organizing content.

**Key Capabilities:**
- Create custom tags
- Tag citations and captures
- Source-level labels (single label per source)
- Many-to-many relationships

**Database Schema:**
- `tags` table (Migration 000002)
- `citation_tags` junction table
- `capture_tags` junction table
- `source_tags` junction table (Migration 000004)
- Source labels (Migration 000004)

**UI Routes:**
- Tag management in various contexts
- Filtering by tags (in development)

---

### 9. Podcasts

**Description:** Import and manage podcast episodes with rich metadata.

**Key Capabilities:**
- Import podcasts via Apple Podcasts URL
- Automatic metadata extraction (show info, episodes)
- Show and episode normalization (avoid duplication)
- Podcast-specific fields: duration, audio URL, artwork
- Episode management per show
- Link episodes to sources for knowledge capture

**Database Schema:**
- `shows` table (Migration 000014)
- `podcast_episodes` table (Migration 000014)
- Transcript fields: `transcript_status`, `transcript_r2_key`, `transcript_error`
- Platform field for tracking source (Apple, Spotify, etc.)

**UI Routes:**
- `/podcasts` - Browse and import podcasts
- `/podcasts/[slug]` - View show with episodes

**Implementation:**
- Backend: `podcast_import_service.go` handles Apple Podcasts scraping
- External API: Apple Podcasts public API

---

### 10. Videos

**Description:** Import and manage YouTube videos with transcripts.

**Key Capabilities:**
- Import videos via YouTube URL
- Automatic metadata extraction (channel, video details)
- Channel and video normalization
- Video-specific fields: duration, video URL, thumbnail
- Transcript generation support
- Track transcription service used

**Database Schema:**
- `channels` table (Migration 000016)
- `videos` table (Migration 000016)
- Channel platform enum (youtube, vimeo, etc.)
- Transcript fields: `transcript_status`, `transcript_source`, `transcript_error`

**UI Routes:**
- `/videos` - Browse and import videos
- `/videos/channels/[id]` - View channel with videos

**Implementation:**
- Backend: `video_import_service.go` handles YouTube integration

---

### 11. Podcast & Video Transcripts

**Description:** Automated transcript generation with AI-powered transcription.

**Key Capabilities:**
- Generate word-level transcripts via AssemblyAI
- Speaker diarization (identify different speakers)
- Timestamped sentences and words
- Cloud storage in Cloudflare R2
- Interactive transcript viewer
- Sentence-by-sentence navigation
- Create citations from transcript selections
- Bidirectional linking (citations ↔ transcript)

**Database Schema:**
- `transcript_status` enum: none, pending, completed, failed
- `transcript_r2_key` for R2 object storage (Migration 000015 renamed from URL to key)
- `transcript_source` to track service used (Migration 000016)
- `transcript_error` for failure messages

**UI Routes:**
- Source detail page → Transcript tab
- Real-time status updates
- Interactive viewer with timestamp navigation

**Implementation:**
- Python RAG service handles transcription via AssemblyAI
- R2 storage for JSON transcripts
- See `docs/PODCAST_TRANSCRIPTS.md` for detailed documentation

**External Services:**
- AssemblyAI for transcription
- Cloudflare R2 for storage

---

## AI-Powered Features

### 13. RAG (Retrieval-Augmented Generation)

**Description:** AI-powered question answering over your knowledge base.

**Key Capabilities:**
- Ask natural language questions
- Retrieve relevant content via semantic search
- Stream AI responses in real-time (Server-Sent Events)
- Source attribution (citations shown inline)
- Hybrid search: vector similarity + BM25 ranking
- Full-text search with PostgreSQL
- Vector search with pgvector

**Database Schema:**
- `rag_embeddings` table (Migration 000005)
- Support for citations, captures, and takeaways
- Content hashing for incremental updates
- Voyage AI embeddings (1024 dimensions)

**UI Routes:**
- `/ask` - RAG query interface

**Implementation:**
- Python RAG service handles AI operations
- Embedding provider: Voyage AI (configurable)
- LLM provider: OpenAI (configurable)
- Supports Ollama for local embeddings
- See `/fast-api/AGENTS.md` for architecture

---

### 14. Source Enrichment

**Description:** URL-based metadata enrichment for sources.

**Key Capabilities:**
- Fetch metadata from supported URLs (e.g., YouTube, Medium, Substack)
- Normalize title/author/published metadata for sources
- Store optional `summary_short` and `summary_long` fields

**Database Schema:**
- `summary_short` and `summary_long` fields

**Implementation:**
- Go backend fetches and normalizes metadata via `EnrichSource`

---

## Admin Features

### 16. Admin Dashboard

**Description:** Administrative interface for user and system management.

**Key Capabilities:**
- View all users
- User statistics dashboard
- Activity trends (90-day charts)
- User detail pages with engagement metrics
- Content counts per user (sources, citations, captures, takeaways)
- Weekly activity trends visualization

**Database Schema:**
- Uses Better-Auth user tables
- Aggregates from sources, citations, captures, takeaways tables

**UI Routes:**
- `/admin` - Admin dashboard home
- `/admin/users` - User list
- `/admin/users/[id]` - User detail with stats

**Implementation:**
- Backend: `admin_service.go` and `admin_handler.go`
- Role-based access via Better-Auth

**Charts:**
- Recharts library for data visualization
- 4-line chart: sources, citations, captures, takeaways
- Weekly granularity over 90 days

---

## Technical Features

### 17. Full-Text Search

**Description:** PostgreSQL-based full-text search across content.

**Key Capabilities:**
- Search citations, captures, and takeaways
- GIN indexes for performance
- English language stemming
- BM25 ranking via pg_search (ParadeDB)
- Trigram similarity for fuzzy matching

**Database Schema:**
- GIN indexes on tsvector columns (Migration 000006)
- BM25 indexes (Migration 000008)
- pg_search extension enabled

**Implementation:**
- PostgreSQL native full-text search
- ParadeDB pg_search for BM25
- Queries use `to_tsvector('english', text)`

---

### 18. Vector Search (Semantic)

**Description:** Semantic search using vector embeddings.

**Key Capabilities:**
- pgvector extension for similarity search
- Cosine similarity ranking
- 1024-dimensional embeddings (Voyage AI)
- Supports citations, captures, and takeaways
- Incremental updates via content hashing (SHA256)
- Hybrid search combining vector + BM25

**Database Schema:**
- `rag_embeddings` table (Migration 000005)
- Polymorphic references (content_type + content_id)
- Content hash for staleness detection

**Implementation:**
- Go backend generates embeddings inline for CRUD content
- FastAPI reads embeddings for RAG and vector search workflows
- Voyage AI as default provider
- Optional local embedding providers
- pgvector for storage and search

---

### 19. Observability

**Description:** OpenTelemetry-based monitoring and tracing.

**Key Capabilities:**
- Distributed tracing across services
- Metrics collection (Prometheus format)
- Log aggregation
- Jaeger for trace visualization
- Grafana for dashboards

**Implementation:**
- OpenTelemetry SDK in Go and Python
- Docker Compose setup in `/observability`
- See `docs/observability.md` for details

**Services:**
- Jaeger: Trace collection and visualization
- Prometheus: Metrics storage
- Grafana: Dashboards and alerting
- Tempo: Trace storage (alternative to Jaeger)

---

### 20. Command Palette

**Description:** Quick navigation and search interface.

**Key Capabilities:**
- Keyboard shortcut (Cmd/Ctrl+K)
- Search sources by title
- Quick navigation
- Recency-based sorting
- Visit tracking (stored in localStorage)

**UI Routes:**
- Global component (accessible anywhere)

**Implementation:**
- React component using shadcn Command
- Local storage for recency tracking

---

### 21. Home Dashboard

**Description:** Personalized dashboard showing recent activity.

**Key Capabilities:**
- Recently active sources
- Quick actions
- Activity overview
- Navigation shortcuts

**UI Routes:**
- `/` (authenticated home)

**Implementation:**
- Next.js server components
- Queries sources by last_active_at

---

## Feature Timeline

### Foundation (Initial Implementation)
- Authentication & authorization (Better-Auth)
- Source management
- Citations and captures
- Sections and structure
- Tags and labels

### Content Import (Podcasts & Videos)
- Migration 000014: Podcast support
- Migration 000016: Video support
- Apple Podcasts import
- YouTube import

### Search & Discovery
- Migration 000005: Vector embeddings (pgvector)
- Migration 000006: Full-text search (PostgreSQL GIN)
- Migration 000008: BM25 ranking (pg_search)
- RAG query interface

### Knowledge Synthesis
- Takeaways feature
- URL metadata enrichment
- Migration 000009/000011: Takeaway embeddings

### Transcripts
- Migration 000014/000015: Podcast transcript fields
- Migration 000016: Video transcript support
- AssemblyAI integration
- Cloudflare R2 storage
- Interactive transcript viewer

### Admin Tools
- Admin dashboard
- User statistics
- Activity trends
- Weekly charts with Recharts

---

## Feature Status Legend

- ✅ **Fully Implemented** - Feature is complete and stable
- 🚧 **In Development** - Feature is partially implemented

### Current Status Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Source Management | ✅ | Fully implemented |
| Authentication | ✅ | Better-Auth integration complete |
| Citations/Captures | ✅ | Core functionality complete |
| Takeaways | ✅ | Fully implemented with embeddings |
| Sections & Structure | ✅ | Hierarchical organization working |
| Tags & Labels | ✅ | Basic tagging complete |
| Podcasts | ✅ | Import and management working |
| Videos | ✅ | Import and management working |
| Transcripts | ✅ | Generation and viewing working |
| RAG Query | ✅ | Working with SSE streaming |
| Full-Text Search | ✅ | BM25 + PostgreSQL working |
| Vector Search | ✅ | pgvector integration complete |
| Admin Dashboard | ✅ | User stats and trends working |
| Command Palette | ✅ | Local-only recency tracking |

---

## Related Documentation

- **Architecture**: `/AGENTS.md` - High-level system architecture
- **Backend**: `/go-api/AGENTS.md` - Go backend documentation
- **Frontend**: `/frontend/AGENTS.md` - Next.js frontend documentation
- **RAG Service**: `/fast-api/AGENTS.md` - Python AI service documentation
- **Transcripts**: `/docs/PODCAST_TRANSCRIPTS.md` - Transcript feature documentation
- **Auth**: `/docs/auth.md` - Authentication architecture
- **Observability**: `/docs/observability.md` - Monitoring and tracing
- **Deployment**: `/docs/DEPLOY.md` - Deployment guide
- **Product**: `/docs/product_overview.md` - Product vision
- **Philosophy**: `/docs/product_philosophy.md` - Design principles

---

## Database Schema Evolution

For a complete history of schema changes, see the migration files in `/go-api/migrations/`:

- **000001** - Authentication schema (Better-Auth)
- **000002** - Core app schema (sources, citations, captures, sections, tags, takeaways)
- **000003** - Speaker and context fields for citations
- **000004** - Source tagging and labels
- **000005** - pgvector for RAG embeddings
- **000006** - Full-text search indexes
- **000007** - Section order_index fixes
- **000008** - BM25 (pg_search) indexes
- **000009** - Takeaway embeddings (first attempt)
- **000010** - Review system (spaced repetition)
- **000011** - Takeaway embeddings (recovery after dirty migration)
- **000012** - Source author field
- **000013** - Source published_at field
- **000014** - Podcast normalization (shows, episodes)
- **000015** - Rename transcript_r2_url to transcript_r2_key
- **000016** - Video support (channels, videos)

---

**Note:** This documentation is current as of January 2026. For the most up-to-date information, check the source code and migration history.
