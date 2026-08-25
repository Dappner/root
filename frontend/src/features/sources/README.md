# Sources Feature Module

## Overview

The Sources feature manages the core knowledge sources in the application (books, articles, videos, podcasts). It provides CRUD operations, metadata management, section organization, and citation/capture hierarchies.

## Architecture

### File Organization

```
sources/
├── api.ts                    # API client functions (wraps FastAPI)
├── keys.ts                   # React Query key factory
├── types.ts                  # Type facade (imports from @/features/rag/rag-api.generated)
├── sources-page-client.tsx   # Main sources list page component
├── hooks/
│   ├── sources.ts           # Source CRUD hooks (useSources, useCreateSource, etc.)
│   ├── sections.ts          # Section management hooks
│   ├── citations.ts         # Citation hooks
│   └── highlights.ts        # Aggregated highlights data hook
├── components/
│   ├── sources-list.tsx     # List view with cards
│   ├── source-header/       # Source detail page header (with inline edit)
│   ├── section-group.tsx    # Hierarchical section rendering
│   ├── citation-item.tsx    # Citation display card
│   ├── capture-item-card.tsx # Standalone capture card
│   └── ... (other components)
├── dialogs/
│   ├── create-source-dialog/ # Create source with metadata fields
│   ├── edit-source-dialog.tsx # Edit source form
│   ├── create-citation-dialog/ # Create citation with location
│   ├── edit-citation-dialog/ # Edit citation form
│   └── ... (other dialogs)
├── pages/
│   ├── source-overview-page.tsx   # Overview route content
│   ├── source-highlights-page.tsx # Highlights route content
│   ├── source-notes-page.tsx      # Notes route content
│   ├── source-transcript-page.tsx # Transcript route content
│   └── source-reflect-page.tsx    # Reflect route content
└── utils/
    ├── metadata.ts          # Source metadata helpers (badges, enrichment)
    ├── location.ts          # Citation location formatting (pages, timestamps)
    ├── section-ranges.ts    # Section range formatting
    ├── sorting.ts           # Citation sorting by location
    └── grouping.ts          # Hierarchical data transformation
```

## Key Concepts

### Source Types

Four supported source types with different metadata fields:
- **Book**: author, isbn, pages
- **Article**: url, publication, published_at
- **Video**: url, channel, duration (seconds)
- **Podcast**: url, show, episode, duration (seconds)

### Data Hierarchy

```
Source
├── Sections (hierarchical tree with parent-child relationships)
│   ├── Citations (quotes, stats, facts, paraphrases)
│   │   └── Capture (optional linked capture)
│   └── Captures (standalone notes without citation)
└── Unsorted (citations/captures without section assignment)
```

### Location Data

Citations track their location in the source:
- **Books**: Page ranges (e.g., pages 10-15)
- **Videos/Podcasts**: Timestamp ranges (e.g., 1:23-2:45)
- **Articles**: No specific location
- **Other**: Custom fallback label

## Data Flow

### Reading Data

1. **Client calls hook**: `useSources()` or `useSource(id)`
2. **Hook calls API wrapper**: `sourcesApi.getSources()`
3. **API wrapper calls FastAPI**: via orval-generated client
4. **Response flows back**: snake_case types from `@/features/rag/rag-api.generated`
5. **Component renders**: using snake_case field access

### Writing Data

1. **User action triggers mutation**: `useCreateSource().mutate(data)`
2. **Mutation calls API**: `sourcesApi.createSource(data)`
3. **Go backend validates and saves**: Returns new source
4. **Cache invalidation**: React Query refetches affected queries
5. **UI updates**: Components re-render with fresh data

## Common Patterns

### Fetching Source with Highlights

```typescript
import { useSource } from "@/features/sources/hooks/sources";
import { useGroupedHighlights } from "@/features/sources/hooks/highlights";

function SourceDetailPage({ sourceId }: { sourceId: number }) {
  const { data: source } = useSource(sourceId);
  const { data: highlights, isLoading } = useGroupedHighlights(sourceId);

  // highlights contains: { sections, unsorted, totalCount }
}
```

### Creating a Source

```typescript
import { useCreateSource } from "@/features/sources/hooks/sources";
import { useDialog } from "@/components/dialogs";
import { CreateSourceDialog } from "@/features/sources/dialogs/create-source-dialog";

function MyComponent() {
  const { openDialog } = useDialog();

  return (
    <Button onClick={() => openDialog(CreateSourceDialog, { defaultType: "book" })}>
      Add Source
    </Button>
  );
}
```

### Managing Sections

```typescript
import { useCreateSection, useMoveSection } from "@/features/sources/hooks/sections";

const createSection = useCreateSection();
const moveSection = useMoveSection();

// Create a section
createSection.mutate({
  sourceId: 123,
  data: { title: "Chapter 1", order_index: 0 },
});

// Move a section to a new parent
moveSection.mutate({
  sourceId: 123,
  sectionId: 456,
  data: { parent_id: 789, order_index: 2 },
});
```

## Utilities

### Metadata Helpers

```typescript
import { buildMetadataBadges, canAutoEnrich, extractDomain } from "../utils/metadata";

// Build display badges from source metadata
const badges = buildMetadataBadges(source); // ["Book", "John Doe", "350 pages"]

// Check if URL can be auto-enriched
const canEnrich = canAutoEnrich("https://youtube.com/watch?v=abc"); // true

// Extract domain from URL
const domain = extractDomain("https://www.example.com/article"); // "example.com"
```

### Location Formatting

```typescript
import { formatCitationLocation, secondsToHms, hmsToSeconds } from "../utils/location";

// Format citation location for display
const location = formatCitationLocation({
  type: "book",
  pageStart: 10,
  pageEnd: 15,
}); // "Pages 10–15"

// Convert seconds to HH:MM:SS
const time = secondsToHms(3665); // "01:01:05"

// Parse HH:MM:SS to seconds
const seconds = hmsToSeconds("1:23"); // 83
```

### Sorting Citations

```typescript
import { sortCitationsByLocation } from "../utils/sorting";

// Sort citations by their natural order (pages or timestamps)
const sortedCitations = citations.sort(sortCitationsByLocation);
```

### Data Grouping

```typescript
import { groupHighlightsBySection } from "../utils/grouping";

// Transform flat data into hierarchical structure
const grouped = groupHighlightsBySection({
  sections: sectionsArray,
  citations: citationsArray,
  captures: capturesArray,
  takeaways: takeawaysArray,
});

// Result: { sections: GroupedSection[], unsorted: {...}, totalCount: number }
```

## Type System

This feature follows the **type facade pattern**. All API types are imported through `types.ts`:

```typescript
// ✅ GOOD - Import from feature types facade
import type { SourceDTO, CreateSourceRequest } from "@/features/sources/types";

// ❌ BAD - Direct import blocked by ESLint
import type { SourceDTO } from "@/features/rag/rag-api.generated";
```

### Key Types

- **SourceDTO**: Complete source object from API (snake_case fields)
- **CreateSourceRequest**: Payload for creating a source
- **UpdateSourceRequest**: Payload for updating a source
- **SourceSectionDTO**: Section with hierarchical data
- **CitationDTO**: Citation with location and optional takeaways
- **CitationWithCapture**: Citation enriched with linked capture
- **GroupedHighlights**: Hierarchical structure of sections/citations/captures

## Cache Management

### Query Keys

```typescript
import { sourcesKeys } from "@/features/sources/keys";

sourcesKeys.all          // ['sources']
sourcesKeys.list()       // ['sources', 'list']
sourcesKeys.detail(id)   // ['sources', 'detail', id]
sourcesKeys.sections(id) // ['sources', 'detail', id, 'sections']
```

## Testing Considerations

- **Hook testing**: Mock API responses, verify cache updates
- **Component testing**: Test UI rendering, user interactions
- **Utility testing**: Pure functions are easy to unit test
- **Integration testing**: Test full data flow with Cypress

## Related Features

- **Captures**: `/features/captures` - Note-taking system
- **Tags**: `/features/tags` - Tagging and organization
- **Takeaways**: `/features/takeaways` - Key insights extraction
- **RAG**: `/features/rag` - AI-powered search and answers

## Migration Notes

### From Drizzle to Go API (2024)

Previously, the frontend used Drizzle for reads. Now all operations go through the Go backend:

- **Before**: `db.query.sources.findMany()`
- **After**: `sourcesApi.getSources()` → Go backend

This change centralizes validation and business logic in the backend.
