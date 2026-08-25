export const takeawayKeys = {
  all: ["takeaways"] as const,
  recent: () => [...takeawayKeys.all, "recent"] as const,
  recentList: (limit: number, offset: number) =>
    [...takeawayKeys.recent(), { limit, offset }] as const,
};
