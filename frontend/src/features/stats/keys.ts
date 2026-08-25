export const statsKeys = {
  all: ["stats"] as const,
  me: (weeksBack?: number) => [...statsKeys.all, "me", weeksBack ?? null] as const,
  user: (userId: string, weeksBack?: number) =>
    [...statsKeys.all, "user", userId, weeksBack ?? null] as const,
};
