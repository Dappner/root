export const notesKeys = {
  all: ["notes"] as const,
  lists: () => [...notesKeys.all, "list"] as const,
  list: (scope: "all" | "general" | { sourceId: number }) =>
    scope === "all"
      ? [...notesKeys.lists(), "all"] as const
      : scope === "general"
      ? [...notesKeys.lists(), "general"] as const
      : [...notesKeys.lists(), "source", scope.sourceId] as const,
  details: () => [...notesKeys.all, "detail"] as const,
  detail: (id: number) => [...notesKeys.details(), id] as const,
};
