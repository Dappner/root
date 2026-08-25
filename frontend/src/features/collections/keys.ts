export const collectionsKeys = {
  all: ["collections"] as const,
  lists: () => [...collectionsKeys.all, "list"] as const,
  list: () => [...collectionsKeys.lists()] as const,
  details: () => [...collectionsKeys.all, "detail"] as const,
  detail: (id: number) => [...collectionsKeys.details(), id] as const,
  sources: (id: number) => [...collectionsKeys.detail(id), "sources"] as const,
};
