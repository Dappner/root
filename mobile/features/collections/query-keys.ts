export const collectionsKeys = {
  all: ["collections"] as const,
  list: () => [...collectionsKeys.all, "list"] as const,
  detail: (id: number) => [...collectionsKeys.all, id] as const,
  sources: (id: number) => [...collectionsKeys.all, id, "sources"] as const,
};
