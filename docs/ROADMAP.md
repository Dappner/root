# Root Product Roadmap

This document outlines the planned features and improvements for Root, organized by priority and development phase.

**Last Updated:** January 2026

---

## Table of Contents

1. [Current Focus](#current-focus)
2. [Near-Term (Q1 2026)](#near-term-q1-2026)
3. [Medium-Term (Q2-Q3 2026)](#medium-term-q2-q3-2026)
4. [Long-Term (Q4 2026+)](#long-term-q4-2026)
5. [Under Consideration](#under-consideration)
6. [Architecture Evolution](#architecture-evolution)

---

## Current Focus

### Stabilization & Polish

**Goal:** Solidify existing features and improve user experience.

- **Review System Redesign**
  - [ ] Reimagine the review workflow and data model (current design deprecated)
  - [ ] Define the minimal viable review loop before reintroducing features

- **Transcript Improvements**
  - [ ] Wire up citation dialog from transcript selection
  - [ ] Add transcript search (find keywords in transcripts)
  - [ ] Add audio player with transcript sync (click sentence → play audio)
  - [ ] Export transcripts (TXT, VTT, SRT formats)

- **Command Palette Sync**
  - [ ] Move recency tracking from localStorage to backend for cross-device sync

---

## Near-Term (Q1 2026)

### Priority 1: Core Workflow Improvements

#### Enhanced Content Capture

- [ ] **Voice Memos**
  - Audio recording
  - Automatic transcription
  - Convert to structured captures/citations

- [ ] **Kindle Import Extension**
  - Chrome extension for importing Kindle highlights
  - Scrape highlights from Kindle web reader
  - Automatic source creation
  - Reconciliation for re-imports
  
- [ ] **PDF Import**
  - Extract highlights and annotations
  - OCR support for scanned PDFs
  - Page number preservation

- [ ] **Web Clipper**
  - Browser extension for article capture
  - Save full text + metadata
  - Screenshot support
  - Automatic source creation

#### Search & Discovery

- [ ] **Global Search**
  - Search across all content types
  - Fuzzy matching for typo tolerance
  - Filters by content type, source, date range
  - Keyboard shortcuts for quick access

- [ ] **Tag-Based Filtering**
  - Filter sources by tags
  - Filter citations by tags
  - Tag analytics (most used tags)
  - Tag suggestions based on content

- [ ] **Related Content**
  - "Related sources" based on semantic similarity
  - "Similar citations" suggestions
  - Cross-source connections
  - Visual knowledge graph (explore view)

---

### Priority 2: Review System Evolution

#### Review System (Reimagined)

- [ ] Define the new review UX and rules before scheduling features
- [ ] Decide whether SM-2 stays or is replaced

---

### Priority 3: Knowledge Synthesis

#### AI-Assisted Writing

- [ ] **Smart Capture Enhancement**
  - AI suggests structure for raw notes
  - Extract key points from rambling thoughts
  - Grammar and clarity improvements
  - Citation suggestions from context

- [ ] **Automated Summaries**
  - Generate source summaries on demand
  - Section-level summaries
  - Progress summaries (what you've captured so far)
  - Customizable summary length/style

---

## Medium-Term (Q2-Q3 2026)

### Priority 1: Advanced AI Features

#### Intelligent Recommendations

- [ ] **Smart Resurfacing**
  - Weekly digest emails with relevant past insights
  - Context-aware suggestions (based on current reading)
  - Serendipitous rediscovery (surface forgotten gems)
  - Customizable resurfacing frequency

- [ ] **Reading Recommendations**
  - Suggest sources based on interests
  - Fill knowledge gaps (topics you haven't explored)
  - Next book recommendations
  - Reading list curation

#### Enhanced RAG

- [ ] **Multi-Source RAG**
  - Ask questions across multiple sources
  - Compare perspectives between sources
  - Find contradictions or agreements
  - Generate synthesis reports

- [ ] **Citation-Aware Responses**
  - Show exact citations for every claim
  - Click citation to jump to source
  - Confidence scores for answers
  - "I don't know" when uncertain

- [ ] **Conversation Threads**
  - Follow-up questions in context
  - Save conversation history
  - Share conversations with others
  - Export conversations to notes

---

### Priority 2: Content Import Expansion

#### More Source Types

- [ ] **RSS Feed Integration**
  - Subscribe to blogs/newsletters
  - Automatic article capture
  - Read/unread tracking
  - Archive after capture

- [ ] **Email Integration**
  - Forward articles to Root (email address)
  - Parse newsletter content
  - Automatic source creation
  - Handle attachments (PDFs)

- [ ] **Twitter/X Integration**
  - Save threads as sources
  - Capture tweets with context
  - Thread unrolling
  - Automatic metadata extraction

- [ ] **Research Paper Import**
  - arXiv integration
  - DOI-based import
  - Automatic citation formatting
  - Abstract and key findings extraction

---

### Priority 3: Collaboration & Sharing

#### Sharing Features

- [ ] **Public Profiles**
  - Optional public profile page
  - Share curated sources and takeaways
  - Privacy controls (choose what to share)
  - Custom profile URL

- [ ] **Export Capabilities**
  - Export to Markdown
  - Export to Notion
  - Export to Obsidian
  - Export to Roam Research
  - CSV export for data analysis

- [ ] **Collaborative Sources**
  - Invite others to contribute to a source
  - Shared highlights and notes
  - Comment threads on citations
  - Version history and attribution

---

## Long-Term (Q4 2026+)

### Priority 1: Platform Maturity

#### Mobile Apps

- [ ] **iOS App**
  - Native iOS experience
  - Offline support
  - Share extension (capture from any app)
  - Widget support (daily review, recent sources)
  - Siri shortcuts

- [ ] **Android App**
  - Native Android experience
  - Offline support
  - Share intents
  - Home screen widgets
  - Google Assistant integration

#### Desktop Apps

- [ ] **Electron Desktop App**
  - Native menu integration
  - Global keyboard shortcuts
  - System tray icon with quick actions
  - Offline mode
  - Auto-updates

---

### Priority 2: Advanced Organization

#### Workspaces & Projects

- [ ] **Multiple Workspaces**
  - Separate contexts (work, personal, research)
  - Workspace-specific settings
  - Switch between workspaces
  - Cross-workspace search

- [ ] **Projects**
  - Group sources by project
  - Project-specific views and filters
  - Project dashboards
  - Collaboration per project

#### Knowledge Base

- [ ] **Wiki Mode**
  - Create interconnected pages
  - Bidirectional links
  - Graph view of connections
  - Markdown support

- [ ] **Templates & Workflows**
  - Custom capture workflows
  - Source type templates
  - Automation rules
  - Zapier/Make integration

---

### Priority 3: Community & Ecosystem

#### Community Features

- [ ] **Public Source Library**
  - Browse popular sources
  - See what others are reading
  - Import public highlights/notes
  - Rate and review sources

- [ ] **Study Groups**
  - Create private groups
  - Shared reading lists
  - Group discussions
  - Collaborative reviews

#### API & Integrations

- [ ] **Public API**
  - REST API for third-party tools
  - OAuth authentication
  - Webhooks for events
  - Rate limiting and quotas

- [ ] **Integrations Marketplace**
  - Official integrations (Notion, Obsidian, etc.)
  - Community-built integrations
  - Integration templates
  - Developer documentation

---

## Under Consideration

These features are being evaluated but not yet committed to the roadmap.

### Reading Progress Tracking

**Pros:**
- Motivating for users
- Useful for statistics
- Helps prioritize active sources

**Cons:**
- Outside core loop (capture → synthesize → recall)
- Adds complexity
- May feel like "work"

**Status:** Deferred until core features are stable

---

### Flashcard Import

**Pros:**
- Users have existing Anki decks
- Lower barrier to entry
- Familiar format

**Cons:**
- Root's review system is different (tied to sources)
- May encourage "orphan" cards without context
- Import complexity

**Status:** Exploring hybrid approach (import with required source attribution)

---

### Social Features

**Pros:**
- Community engagement
- Shared learning
- Network effects

**Cons:**
- Privacy concerns
- Moderation overhead
- May dilute focus on personal knowledge

**Status:** Watching for user demand, starting with opt-in sharing

---

### Gamification

**Pros:**
- Increased engagement
- Fun and motivating
- Virality potential

**Cons:**
- May undermine intrinsic motivation
- Can feel gimmicky
- Risk of optimizing for points instead of learning

**Status:** Considering subtle gamification (streaks, milestones) without heavy game mechanics

---

## Architecture Evolution

### Current State

```
Next.js Frontend
  ├─ Better-Auth (JWT via JWKS)
  └─ Proxy to Go API (all data operations)

Go Backend
  ├─ Chi router
  ├─ sqlc for queries
  ├─ All CRUD operations
  └─ Business logic

Python RAG Service
  ├─ FastAPI
  ├─ Voyage AI embeddings
  └─ OpenAI LLM
```

### Target State (Production)

```
Vite SPA Frontend
  └─ All API calls to Go

Hono Auth Service
  └─ Better-Auth (dedicated service)

Go Backend
  ├─ All CRUD operations
  ├─ Job orchestration
  └─ Business logic

Python RAG Service
  └─ AI operations only
```

### Migration Path

**Phase 1: Infrastructure Consolidation** (Q2 2026)
- Colocate Go backend + DB in same region
- Eliminate latency motivation for Next.js direct DB access
- Benchmark performance

**Phase 3: Auth Service** (Q4 2026)
- Build Hono service for Better-Auth
- Migrate auth endpoints
- Test JWKS flow

**Phase 4: Frontend Migration** (Q1 2027)
- Build Vite SPA
- Migrate routes incrementally
- Switch DNS
- Sunset Next.js

**Why this order:**
- De-risk early (consolidate writes first)
- Validate assumptions (colocate infra to remove latency concern)
- Minimize disruption (auth service in parallel with frontend work)
- Big-bang frontend swap at end (when everything else is stable)

**Note:** Current hybrid architecture is optimal for solo dev velocity. Don't migrate prematurely.

---

## Deferred / Out of Scope

### Features Explicitly Not Planned

- **Social Media Platform:** Root is personal knowledge management, not social media
- **Note-Taking App:** Use Obsidian/Notion for unstructured notes; Root is for structured knowledge from sources
- **Task Management:** Use Todoist/Things; Root is for knowledge, not tasks
- **Calendar Integration:** Reading time is personal, no need for scheduling
- **Video Player:** Link to external players (YouTube, Spotify); don't reinvent media players
- **Real-Time Collaboration:** Complex to build, limited use case for personal knowledge

---

## How to Contribute

### Prioritization Criteria

Features are prioritized based on:

1. **Impact:** Does it improve the core loop (capture → synthesize → recall)?
2. **Effort:** Can it be built incrementally without major refactoring?
3. **Risk:** What's the downside if it doesn't work?
4. **Validation:** Have users explicitly requested this?
5. **Strategic:** Does it align with long-term vision?

### Request a Feature

- Open a GitHub issue with the `feature-request` label
- Describe the problem, not the solution
- Explain your use case and workflow
- Mention any workarounds you're using

### Propose a Design

- Create a design document in `docs/` (see existing files for template)
- Submit a PR with the design doc
- Discuss in issue comments
- Iterate based on feedback

---

## Related Documentation

- **Features:** `/docs/FEATURES.md` - Current features documentation
- **Product Overview:** `/docs/product_overview.md` - Product vision
- **Product Philosophy:** `/docs/product_philosophy.md` - Design principles
- **Architecture Evolution:** `/docs/architecture-evolution.md` - Long-term architecture plan
- **TODOs:** `/TODOS.md` - Short-term technical todos

---

## Version History

- **January 2026:** Initial roadmap based on existing designs and discussions
- Roadmap is a living document and will be updated quarterly

---

**Note:** This roadmap is aspirational and subject to change based on user feedback, technical constraints, and strategic priorities. Features may be added, removed, or re-prioritized.
