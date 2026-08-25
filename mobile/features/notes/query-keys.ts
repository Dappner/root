export const notesKeys = {
  all: ["notes"] as const,
  list: () => [...notesKeys.all, "list"] as const,
  detail: (id: number) => [...notesKeys.all, id] as const,
  bySource: (sourceId: number) => [...notesKeys.all, "source", sourceId] as const,
};
