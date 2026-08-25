export const suggestionsKeys = {
  all: ["suggestions"] as const,
  source: (sourceId: number) => [...suggestionsKeys.all, "source", sourceId] as const,
};
