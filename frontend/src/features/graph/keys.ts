export const graphKeys = {
  all: ["graph"] as const,
  full: () => [...graphKeys.all, "full"] as const,
  neighborhood: (nodeId: string) =>
    [...graphKeys.all, "neighborhood", nodeId] as const,
};
