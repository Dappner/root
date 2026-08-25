export const suggestionKeys = {
  all: ["suggestions"] as const,
  lists: () => [...suggestionKeys.all, "list"] as const,
  list: (sourceId: number) => [...suggestionKeys.lists(), sourceId] as const,
  pending: () => [...suggestionKeys.all, "pending"] as const,
  dismissed: () => [...suggestionKeys.all, "dismissed"] as const,
  detail: (suggestionId: number) => [...suggestionKeys.all, "detail", suggestionId] as const,
};
