/**
 * Query key factory for sources
 * Following TkDodo's pattern for type-safe, hierarchical query keys
 */
export const sourcesKeys = {
  all: ["sources"] as const,
  lists: () => [...sourcesKeys.all, "list"] as const,
  list: () => [...sourcesKeys.lists()] as const,
  details: () => [...sourcesKeys.all, "detail"] as const,
  detail: (id: number) => [...sourcesKeys.details(), id] as const,
  highlights: (id: number) => [...sourcesKeys.detail(id), "highlights"] as const,
  sections: (id: number) => [...sourcesKeys.detail(id), "sections"] as const,
  counts: () => [...sourcesKeys.all, "counts"] as const,
};

/**
 * Query key factory for citations
 */
export const citationsKeys = {
  all: ["citations"] as const,
  bySource: (sourceId: number) => [...citationsKeys.all, "bySource", sourceId] as const,
};
