export const sourcesKeys = {
  all: ["sources"] as const,
  list: () => [...sourcesKeys.all, "list"] as const,
  detail: (id: number) => [...sourcesKeys.all, id] as const,
  sections: (id: number) => [...sourcesKeys.all, id, "sections"] as const,
  citations: (id: number) => [...sourcesKeys.all, id, "citations"] as const,
  captures: (id: number) => [...sourcesKeys.all, id, "captures"] as const,
  takeaways: (id: number) => [...sourcesKeys.all, id, "takeaways"] as const,
};
