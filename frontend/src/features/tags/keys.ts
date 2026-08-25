export const tagsKeys = {
  all: ["tags"] as const,
  lists: () => [...tagsKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...tagsKeys.lists(), filters] as const,
  details: () => [...tagsKeys.all, "detail"] as const,
  detail: (id: number) => [...tagsKeys.details(), id] as const,
};
