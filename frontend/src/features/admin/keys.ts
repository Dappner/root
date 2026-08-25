/**
 * Query key factory for admin
 * Following TkDodo's pattern for type-safe, hierarchical query keys
 */
export const adminKeys = {
  all: ["admin"] as const,

  // Users
  users: () => [...adminKeys.all, "users"] as const,
  usersList: () => [...adminKeys.users(), "list"] as const,
  user: (id: string) => [...adminKeys.users(), "detail", id] as const,

  // Embeddings
  embeddings: () => [...adminKeys.all, "embeddings"] as const,
  staleEmbeddingsCount: (userId: string) =>
    [...adminKeys.embeddings(), "stale-count", userId] as const,
};
