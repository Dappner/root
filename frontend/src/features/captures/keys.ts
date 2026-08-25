export const capturesKeys = {
  all: ["captures"] as const,
  bySource: (sourceId: number) =>
    [...capturesKeys.all, "bySource", sourceId] as const,
  detail: (id: number) => [...capturesKeys.all, "detail", id] as const,
};
