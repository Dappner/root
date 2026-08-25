# Review System (Spaced Repetition)

High-level overview of Root's spaced repetition review system for long-term retention.

---

## Deprecation Notice

This document describes an older review-system design that is **not in active use**.
The original implementation attempt proved too complex and did not fit the intended workflow.
The review system needs to be **reimagined from scratch** before any of this is revived.

Use this doc for historical context only; do not treat it as current behavior.

## Overview

The review system helps users retain knowledge from their sources using **spaced repetition** - an evidence-based learning technique that tracks review performance and prioritizes items based on difficulty and staleness.

**Key Features:**
- AI-generated review items (Q&A and quote recall)
- SM-2 algorithm for priority calculation and data collection
- Adaptive difficulty adjustment
- Ad-hoc review sessions (review anytime)
- Priority-based ordering (struggled/stale items first)

**Current Implementation:**
- **Ad-hoc mode**: Users can review anytime without time-based scheduling constraints
- **Priority ordering**: Items are sorted by `(1 / ease_factor) × days_since_last_review`
- **Algorithm still active**: SM-2 calculations run and collect data for future scheduling features

---

## User Flow

### 1. Content Creation
User adds content to a source:
- **Citations** - Quotes, stats, facts, paraphrases
- **Takeaways** - Key insights from the source
- **Captures** - Quick highlights with optional AI processing

### 2. Generate Suggestions
When source has sufficient content (content score ≥ 12):
1. User clicks **"Generate Review Items"** button
2. Backend calls Python RAG service with source content
3. AI (GPT-4o-mini) generates 5-10 review suggestions:
   - **Q&A items** (~60%) - Test understanding
   - **Quote recall items** (~40%) - Test memory of key quotes
4. Each suggestion includes:
   - Prompt (question or partial quote)
   - Answer (grounded in source material)
   - Difficulty (easy/medium/hard)
   - Reasoning (why this is important)

### 3. Review Suggestions
User visits **Suggestion Inbox** (`/review/suggestions?sourceId={id}`):
- Review AI-generated suggestions
- Edit prompts/answers if needed
- **Accept** → Creates review item
- **Reject** → Marks as rejected

### 4. Review Sessions
User visits **Review Session** (`/review` or `/review?source_id={id}`):
- Shows **all items** for user/source, ordered by **priority score**
- Priority = `(1 / ease_factor) × days_since_last_review`
  - Items with lower ease factor (struggled) → higher priority
  - Items not reviewed recently → higher priority
- User can **review anytime** (no time-based blocking)
- User sees prompt, clicks "Show Answer"
- Grades their recall:
  - **Forgot** - Reset to 1 day interval, reduce ease factor
  - **Hard** - Slight increase (1.2× interval), reduce ease factor
  - **Good** - Normal increase (SM-2 algorithm)
  - **Easy** - Faster increase (1.3× multiplier), increase ease factor
- Algorithm updates interval, ease factor, and `last_reviewed_at`
- User can exit session anytime

---

## Content Score System

**Formula:** `citations_count + (2 × takeaways_count)`

**Thresholds:**
- **≥ 12** - Enable generation (recommended)
- **8-11** - Warning (can generate but lower quality)
- **< 8** - Disabled

**Examples:**
- 6 citations + 3 takeaways = 6 + (2×3) = **12** ✅
- 4 citations + 2 takeaways = 4 + (2×2) = **8** ⚠️
- 10 citations + 0 takeaways = **10** ⚠️

---

## Spaced Repetition Algorithm (SM-2)

### Current Usage (Ad-hoc Mode)

**Algorithm Role:**
- **Priority Calculation**: Orders items by `(1 / ease_factor) × days_since_last_review`
- **Data Collection**: Tracks ease factor, intervals, review history for future scheduling
- **Not Used For**: Time-based filtering (users can review anytime)

### Review States
- **New** - Never reviewed
- **Learning** - Interval < 21 days
- **Review** - Interval ≥ 21 days (graduated)

### Algorithm Mechanics (Still Active)

**Interval Progression:**
- **First review:** 1 day
- **Second review:** 6 days
- **Subsequent reviews:** Previous interval × ease factor

**Ease Factor:**
- Starts at 2.5
- Increases with "Easy" (+0.15, no cap)
- Decreases with "Hard" (-0.15) or "Forgot" (-0.2)
- Minimum: 1.3

**Note**: Intervals and due dates are still calculated and stored for future scheduling features, but are not currently used to filter which items are shown.

### Adaptive Difficulty
After 5+ reviews, system auto-adjusts difficulty based on performance:
- Average outcome < 2.0 → Upgrade to "hard"
- Average outcome > 3.5 → Downgrade to "easy"

---

## Architecture

### Backend (Go)
**Location:** `go-api/internal/service/review_service.go`

**Responsibilities:**
- Review item CRUD operations
- SM-2 algorithm implementation
- Difficulty adjustment logic
- Content score calculation
- Suggestion management (accept/reject)

**Database Schema:**
```sql
review_items           -- Active review items (polymorphic: citation/takeaway)
review_suggestions     -- AI-generated suggestions (pending/accepted/rejected)
reviews                -- History of all review attempts
```

**Key Constants:**
- `ReviewGraduationDays = 21` - Learning → Review transition
- `ContentScoreThreshold = 12` - Minimum to enable generation
- `MaxNewItemsPerSession = 5` - Limit new introductions (deferred)

### RAG Service (Python)
**Location:** `fast-api/app/services/review_generator.py`

**Responsibilities:**
- Generate review suggestions using LLM
- Validate AI responses
- Ensure answers are grounded in source content

**LLM Configuration:**
- Model: `gpt-4o-mini`
- Temperature: `0.7` (more creative)
- Output: Structured JSON with 5-10 suggestions

**Prompt Strategy:**
- Provides full source context (takeaways, citations, captures)
- Enforces grounding requirement (answers must be verbatim)
- Requests reasoning for each suggestion
- Balances Q&A (~60%) vs quote recall (~40%)

### Frontend (Next.js)
**Location:** `frontend/src/features/review/`

**Components:**
- `review-session.tsx` - Full review session UI
- `review-item-card.tsx` - Individual review item display
- `review-items-section.tsx` - List of review items
- `source-recall-tab.tsx` - Source-specific review management

**Hooks:** `features/review/hooks.ts`
- `useReviewItems(sourceId?)` - Get review items ordered by priority
- `useGradeReviewItem()` - Submit review outcome
- `useGenerateSuggestions()` - Trigger AI generation
- `useSuggestions(sourceId)` - Get pending suggestions
- `useContentScore(sourceId)` - Check if source ready

---

## API Endpoints

### Review Items
```
GET    /go-api/review/items              - Get all review items, ordered by priority
                                        Query params: source_id (optional)
GET    /go-api/review/items/new          - Get new items (not introduced) (deferred)
POST   /go-api/review/items/:id/grade    - Grade a review item
DELETE /go-api/review/items/:id          - Delete review item (future)
```

### Suggestions
```
POST   /go-api/review/suggestions/generate              - Generate AI suggestions
GET    /go-api/review/suggestions?source_id=X           - List pending suggestions
PATCH  /go-api/review/suggestions/:id                   - Edit suggestion
POST   /go-api/review/suggestions/:id/accept            - Accept → create item
POST   /go-api/review/suggestions/:id/reject            - Reject suggestion
```

### Stats & Scoring
```
GET    /go-api/review/stats                             - Review statistics
POST   /go-api/review/sources/:id/content-score         - Calculate content score
```

---

## Data Flow

### Generate Suggestions
```
User clicks "Generate"
  ↓
Frontend → Go Backend
  POST /go-api/review/suggestions/generate
  ↓
Go Backend → Python RAG Service
  POST /rag/generate-review-items
  {
    source: {...},
    takeaways: [...],
    citations: [...],
    captures: [...]
  }
  ↓
Python RAG Service → OpenAI GPT-4o-mini
  LLM generates 5-10 review items
  ↓
Go Backend ← Python RAG Service
  Returns suggestions
  ↓
Go Backend saves to review_suggestions table
  Status: "pending"
  ↓
Frontend ← Go Backend
  Redirects to /review/suggestions?sourceId=X
```

### Review Flow
```
User opens review session (anytime)
  ↓
Frontend fetches ALL items for user/source
  GET /go-api/review/items?source_id=X
  ↓
Go Backend calculates priority scores
  Priority = (1 / ease_factor) × days_since_last_review
  Sorts items by priority DESC
  Returns sorted list
  ↓
User reviews items in priority order
User grades item (forgot/hard/good/easy)
  ↓
Frontend → Go Backend
  POST /go-api/review/items/:id/grade
  { outcome: "good" }
  ↓
Go Backend applies SM-2 algorithm
  - Updates interval_days
  - Updates ease_factor
  - Updates due_at (calculated but not used for filtering)
  - Updates last_reviewed_at ← NEW
  - Creates review history record
  ↓
Go Backend (async) adjusts difficulty
  After 5+ reviews, updates metadata.difficulty
  ↓
Frontend ← Go Backend
  Returns updated review item
```

---

## Best Practices

### For Users
- **Review regularly** for best retention (frequency is up to you)
- **Be honest with grades** (don't always choose "good")
- **Generate suggestions** after capturing sufficient content (score ≥ 12)
- **Edit AI suggestions** to match your understanding
- **Review anytime** - no need to wait for scheduled due dates

### For Developers
- **Priority calculation** is in `review_service.go:calculatePriorityScore()`
- **Content score thresholds** configurable in `review_service.go`
- **LLM temperature** (0.7) balances creativity and accuracy
- **SM-2 constants** can be adjusted based on user feedback
- **Difficulty adjustment** requires ≥5 reviews to prevent premature changes
- **Algorithm still runs** even in ad-hoc mode (collects data for future features)

---

## Current Limitations (Ad-hoc Mode)

These features are deferred until scheduling is re-enabled:
- ❌ Time-based scheduling (no "due today" filtering)
- ❌ Daily review widget
- ❌ Review streak tracking
- ❌ Optimal review timing notifications
- ❌ Session size limits (currently shows all items)

---

## Future Enhancements

### Phase 1 (Scheduling Re-enablement)
- [ ] Re-enable time-based scheduling as optional
- [ ] Daily widget with smart item selection
- [ ] Review notifications ("5 items due today")
- [ ] Review streak tracking
- [ ] Session size options (quick/full)

### Phase 2 (Advanced Features)
- [ ] Custom review schedules per user
- [ ] Review item tags/categories
- [ ] Mobile-optimized review interface
- [ ] Review session time tracking
- [ ] Bulk suggestion generation
- [ ] Export review statistics
- [ ] Collaborative review items (share with others)
- [ ] Review calendar/timeline visualization

---

## References

- **SM-2 Algorithm:** [SuperMemo](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- **Backend Implementation:** `go-api/internal/service/review_service.go`
- **RAG Service:** `fast-api/app/services/review_generator.py`
- **Frontend Components:** `frontend/src/features/review/`
