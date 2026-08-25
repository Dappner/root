export const takeawaysKeys = {
  all: ["takeaways"] as const,
  lists: () => [...takeawaysKeys.all, "list"] as const,
  list: (sourceId: number) => [...takeawaysKeys.lists(), sourceId] as const,
  details: () => [...takeawaysKeys.all, "detail"] as const,
  detail: (sourceId: number, takeawayId: number) =>
    [...takeawaysKeys.details(), sourceId, takeawayId] as const,
  parallels: (takeawayId: number) =>
    [...takeawaysKeys.all, "parallels", takeawayId] as const,
};
